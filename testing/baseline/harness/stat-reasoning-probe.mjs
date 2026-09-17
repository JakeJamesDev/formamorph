// Stat-updates REASONING probe. Runs the live stat-updates prompt over the gold cases (../stat-relevance-cases.json)
// under several native-reasoning arms and grades each reply two ways: the relevance score the stat-relevance
// probe uses (hit / miss / spurious / clean), and the failure that motivated this probe — a reasoning model
// told not to think that writes its reasoning into the answer instead, runs into the stat pass's output cap,
// and never reaches a stat line ("spill"). The app applies nothing from a spilled reply.
//
// Arms mirror what the app can send. `off` is the shipped default (budget 0). `low` is the shipped Low
// (25% of the stat cap, which is only 16 × stats + 16 tokens — a few dozen tokens of thought). `think` gives
// a real budget on top of the cap, to learn whether thinking helps the stat pass at all before deciding what
// the shipped Low should be. A cloud model takes an effort literal instead and ignores the budget, so it can
// only run `off` and `low`.
//
// Engine models (`modelPath` in profiles.json) are loaded into the built-in engine the way run.mjs does, so
// the `<think>` re-wrapping and the budget field behave exactly as on the desktop build.
//
// Usage:  node stat-reasoning-probe.mjs --model <label> [--arms off,low,think] [--runs 3] [--think-budget 400]

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const require_ = createRequire(import.meta.url);

const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const modelLabel = argVal("--model");
if (!modelLabel) { console.error("stat-reasoning-probe: --model <label> is required"); process.exit(1); }
const runs = Number(argVal("--runs") || 3);
const thinkBudget = Number(argVal("--think-budget") || 400);
const armNames = (argVal("--arms") || "off,low,think").split(",");
const TEMP = 0.2; // the app's statUpdates sampler pin
const ENGINE_PORT = 8977;

const cfg = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const model = cfg.models.find((m) => m.label === modelLabel);
if (!model) { console.error(`no model labeled ${modelLabel} in profiles.json`); process.exit(1); }
const onEngine = Boolean(model.modelPath);
const { world, stats, cases } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../stat-relevance-cases.json"), "utf8"));

// The app's stat cap: `statUpdatesCap` in src/lib/turnPipeline/turnPasses.ts.
const CAP = 16 * stats.length + 16;
const ARMS = {
  off: { budget: 0, effort: "none", maxTokens: CAP },
  low: { budget: Math.round(0.25 * CAP), effort: "low", maxTokens: CAP },
  think: { budget: thinkBudget, effort: "medium", maxTokens: CAP + thinkBudget },
};
// Endpoint-only arms: an effort literal alone (`level:none|low|medium|high`), or the literal with the budget
// field beside it (`level+budget:high`), to learn which of the two an endpoint honors. max_tokens is raised
// so the literal has room to matter; a reply that never thinks is unaffected by the headroom.
const LEVELS = ["none", "low", "medium", "high"];
for (const l of LEVELS) {
  ARMS[`level:${l}`] = { effort: l, maxTokens: CAP + thinkBudget };
  ARMS[`level+budget:${l}`] = { effort: l, budget: l === "none" ? 0 : thinkBudget, withBudget: true, maxTokens: CAP + thinkBudget };
}
const arms = armNames.filter((a) => ARMS[a] && (onEngine ? !a.startsWith("level") : a !== "think"));

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd();
};
const SYS = grab("defaultStatUpdatesPrompt");
const USER = grab("defaultStatUpdatesUserPrompt");
const statsBlock = stats
  .map((s) => `- **${s.name}:** ${s.value}/${s.max}${s.description ? ` - ${s.description}` : ""}`)
  .join("\n");
const renderSys = () =>
  SYS.replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<STATS DESCRIPTION|numbers.meaning.markdown>", statsBlock)
    .replaceAll("<TRAITS DESCRIPTION|markdown>", "None")
    .replaceAll("<NOTES>", "None");
const renderUser = (narration) => USER.replaceAll("<NARRATION>", narration);
const NAMES = new Map(stats.map((s) => [s.name.toLowerCase(), s.name]));

// Faithful mirror of parseStatUpdates (name-match, first number after colon, skip value/max echoes).
function parse(text) {
  const out = {};
  (text || "").split("\n").forEach((line) => {
    const sep = line.indexOf(":");
    if (sep === -1) return;
    const key = line.slice(0, sep).replace(/^[\s*_-]+/, "").replace(/[\s*_]+$/, "").toLowerCase();
    if (!key) return;
    const rest = line.slice(sep + 1);
    const m = rest.match(/[+-]?\d+(?:\.\d+)?/);
    if (!m) return;
    if (/^\s*\//.test(rest.slice((m.index ?? 0) + m[0].length))) return;
    const v = Math.round(parseFloat(m[0]));
    if (Number.isNaN(v)) return;
    out[key] = (out[key] || 0) + v;
  });
  return out;
}

// The app strips the think block before parsing; a reply that is only prose after that is a spill.
const splitThink = (raw) => {
  const think = [...raw.matchAll(/<think>([\s\S]*?)(?:<\/think>|$)/g)].map((m) => m[1]).join("");
  const answer = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "").trim();
  return { think, answer };
};
// Anything the app's parser reads as nothing counts as empty: blank, a "no stats" line, `{}`, or any reply
// under a handful of words. A spill is prose — sentences of reasoning where the stat lines should be.
const isEmptyAnswer = (t) => {
  const s = t.replace(/\s/g, "").toLowerCase();
  return s === "" || s.includes("nostat") || s === "none" || s.includes("nothing") || t.trim().split(/\s+/).length < 6;
};

let engine = null;
async function startEngine() {
  engine = require_(path.join(REPO_ROOT, "electron", "llmEngine.cjs"));
  console.log(`loading ${path.basename(model.modelPath)} into the built-in engine (port ${ENGINE_PORT})…`);
  await engine.start({ modelPath: model.modelPath, port: ENGINE_PORT, contextSize: model.contextSize ?? 4096 });
  for (let i = 0; i < 240 && engine.getState().status === "loading"; i++) await new Promise((r) => setTimeout(r, 500));
  const s = engine.getState();
  if (s.status !== "ready") throw new Error(`engine failed to load: ${s.error ?? s.status}`);
}
async function stopEngine() { if (engine) { try { await engine.stop(); } catch { /* down */ } } }

const endpointUrl = onEngine ? `http://127.0.0.1:${ENGINE_PORT}/v1/chat/completions` : (model.endpointUrl ?? cfg.endpointUrl);
async function call(narration, arm) {
  const headers = { "Content-Type": "application/json" };
  const token = model.apiToken ?? cfg.apiToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = {
    model: onEngine ? path.basename(model.modelPath) : model.modelName,
    messages: [{ role: "system", content: renderSys() }, { role: "user", content: renderUser(narration) }],
    max_tokens: arm.maxTokens,
    temperature: TEMP,
    stream: false,
  };
  if (onEngine) body.thinking_budget_tokens = arm.budget;
  else { body.reasoning_effort = arm.effort; if (arm.withBudget) body.thinking_budget_tokens = arm.budget; }
  const t0 = Date.now();
  const res = await fetch(endpointUrl, { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json();
  const choice = j.choices?.[0];
  const raw = choice?.message?.content ?? "";
  const reasoning = choice?.message?.reasoning ?? choice?.message?.reasoning_content ?? "";
  return { raw: raw.trim(), reasoning, finish: choice?.finish_reason ?? "?", ms: Date.now() - t0, tokens: j.usage?.completion_tokens ?? null };
}

const dir = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "—");

console.log(`Stat-reasoning probe · ${model.label} · ${onEngine ? "built-in engine" : endpointUrl} · temp ${TEMP} · cap ${CAP} · ${runs} run(s)/case · arms ${arms.join(",")}`);
if (onEngine) await startEngine();
try {
  await call("warm up", ARMS[arms[0]]).catch(() => {});
  const summary = {};
  for (const armName of arms) {
    const arm = ARMS[armName];
    const agg = { total: 0, pass: 0, hit: 0, miss: 0, spurious: 0, spill: 0, truncated: 0, noopTotal: 0, noopClean: 0, ms: 0, thinkChars: 0 };
    console.log(`\n=== arm ${armName}: budget ${arm.budget} · max_tokens ${arm.maxTokens}${onEngine ? "" : ` · reasoning_effort ${arm.effort}`}`);
    for (const c of cases) {
      const isNoop = !c.expect || Object.keys(c.expect).length === 0;
      for (let r = 0; r < runs; r++) {
        const got = await call(c.narration, arm);
        const { think, answer } = splitThink(got.raw);
        const parsed = parse(answer);
        const expect = c.expect || {};
        const allow = new Set((c.allow || []).map((x) => x.toLowerCase()));
        const expKeys = new Set(Object.keys(expect).map((x) => x.toLowerCase()));
        const misses = [], spur = [];
        let hits = 0;
        for (const [name, d] of Object.entries(expect)) {
          const v = parsed[name.toLowerCase()];
          if (v !== undefined && dir(v) === d) hits++; else misses.push(`${name} ${d}`);
        }
        for (const [k, v] of Object.entries(parsed)) if (v !== 0 && !expKeys.has(k) && !allow.has(k)) spur.push(`${NAMES.get(k) || k} ${dir(v)}`);
        const spill = Object.keys(parsed).length === 0 && !isEmptyAnswer(answer);
        const pass = misses.length === 0 && spur.length === 0 && !spill;
        agg.total++; if (pass) agg.pass++;
        agg.hit += hits; agg.miss += misses.length; agg.spurious += spur.length;
        if (spill) agg.spill++; if (got.finish === "length") agg.truncated++;
        if (isNoop) { agg.noopTotal++; if (Object.keys(parsed).length === 0) agg.noopClean++; }
        agg.ms += got.ms; agg.thinkChars += think.length + got.reasoning.length;
        const flags = [spill && "SPILL", got.finish === "length" && "TRUNC", misses.length && `MISS ${misses.join("/")}`, spur.length && `SPUR ${spur.join("/")}`].filter(Boolean).join(" ");
        console.log(`[${pass ? "PASS" : "FAIL"}] ${c.name}#${r + 1} ${got.ms}ms think=${think.length + got.reasoning.length}ch ${flags} :: ${JSON.stringify(answer.slice(0, 100))}`);
      }
    }
    summary[armName] = agg;
  }
  console.log(`\n${model.label} — summary (${runs} runs × ${cases.length} cases)`);
  console.log("arm    | clean | hits | miss | spur | spill | trunc | noop-clean | ms/call | think ch/call");
  for (const [name, a] of Object.entries(summary)) {
    console.log(`${name.padEnd(6)} | ${pct(a.pass, a.total).padStart(5)} | ${String(a.hit).padStart(4)} | ${String(a.miss).padStart(4)} | ${String(a.spurious).padStart(4)} | ${String(a.spill).padStart(5)} | ${String(a.truncated).padStart(5)} | ${pct(a.noopClean, a.noopTotal).padStart(10)} | ${String(Math.round(a.ms / a.total)).padStart(7)} | ${Math.round(a.thinkChars / a.total)}`);
  }
} finally {
  await stopEngine();
}
