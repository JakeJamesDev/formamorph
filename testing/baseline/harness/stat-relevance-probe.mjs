// Stat-updates RELEVANCE probe. Feeds the fixed gold cases (../stat-relevance-cases.json) through the live
// stat-updates prompt against a local model and grades each: did it move the expected stat(s) in the right
// direction (hit), miss one, or touch a trap stat (spurious). Uses a synthetic 6-stat context because the
// tracked Sedge world has only 2 stats — too thin to test relevance. Renders the stats block exactly as the
// app's `<STATS DESCRIPTION|numbers.meaning.markdown>` token does (`- **Name:** value/max - description`).
//
// Usage:  node stat-relevance-probe.mjs [--model rocinante] [--runs 2]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const modelFilter = argVal("--model");
const runs = Number(argVal("--runs") || 1);

const cfg = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const model = cfg.models.find((m) => !modelFilter || m.label.includes(modelFilter)) ?? cfg.models[0];
const { world, stats, cases } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../stat-relevance-cases.json"), "utf8"));

// Pull the live prompts from source (no regex-backtick headaches — slice between the template backticks).
const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultStatUpdatesPrompt");
const USER = grab("defaultStatUpdatesUserPrompt");

// Renders the stats block exactly as the app's live `<STATS DESCRIPTION|numbers.meaning.markdown>` token now
// does: `- **Name:** value/max - description`. Descriptions are now plumbed through the real context, so this
// mirrors production rather than being an experimental augmentation.
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

async function call(narration) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
  const res = await fetch(cfg.endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.modelName,
      messages: [{ role: "system", content: renderSys() }, { role: "user", content: renderUser(narration) }],
      max_tokens: 200,
      temperature: 0.7,
      stream: false,
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const dir = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

console.log(`Stat-relevance probe · ${model.label} · ${runs} run(s)/case\n`);
await call("warm up").catch(() => {});
const agg = { hit: 0, miss: 0, spurious: 0, pass: 0, total: 0 };
for (const c of cases) {
  for (let r = 0; r < runs; r++) {
    const raw = await call(c.narration);
    const parsed = parse(raw);
    const expect = c.expect || {};
    const allow = new Set((c.allow || []).map((x) => x.toLowerCase()));
    const expKeys = new Set(Object.keys(expect).map((x) => x.toLowerCase()));
    const hits = [], misses = [], spur = [];
    for (const [name, d] of Object.entries(expect)) {
      const got = parsed[name.toLowerCase()];
      if (got !== undefined && dir(got) === d) hits.push(`${name} ${d}`);
      else misses.push(`${name} ${d} (${got !== undefined ? "got " + dir(got) : "none"})`);
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== 0 && !expKeys.has(k) && !allow.has(k)) spur.push(`${NAMES.get(k) || "?" + k} ${dir(v)}`);
    }
    const pass = misses.length === 0 && spur.length === 0;
    agg.hit += hits.length; agg.miss += misses.length; agg.spurious += spur.length;
    agg.total++; if (pass) agg.pass++;
    console.log(`[${pass ? "PASS" : "FAIL"}] ${c.name}${runs > 1 ? ` #${r + 1}` : ""}  ::  ${JSON.stringify(raw)}`);
    if (hits.length) console.log(`        hit: ${hits.join(", ")}`);
    if (misses.length) console.log(`        MISS: ${misses.join(", ")}`);
    if (spur.length) console.log(`        SPURIOUS: ${spur.join(", ")}`);
  }
}
console.log(`\n${agg.pass}/${agg.total} case-runs clean · hits=${agg.hit} misses=${agg.miss} spurious=${agg.spurious}`);
