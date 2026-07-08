// Turn-SUMMARY probe. Feeds fixed gold cases (../summary-cases.json) through the live summary prompt against
// a local model and auto-checks the mechanically-verifiable rules: single line, <=2 sentences, opens
// second-person ("you"), no verbatim quotes, exact "nothing notable" on the idle case, and name discipline
// (no invented/unrevealed name - flagged as any capitalized non-sentence-initial word absent from the
// narration, plus an explicit per-case forbid list). Prose quality itself still needs eyeballing the raw
// output printed on each line.
//
// Usage:  node summary-probe.mjs [--model rocinante] [--runs 3] [--temp 0.3]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const modelFilter = argVal("--model");
const runs = Number(argVal("--runs") || 1);
const temp = Number(argVal("--temp") ?? 0.3); // matches what the app now pins for summary
const only = argVal("--only"); // comma-separated case-name substrings to restrict the run
const seed = argVal("--seed");
const extras = { ...(seed != null && { seed: Number(seed) }) };

const cfg = JSON.parse(await readFile(path.join(HARNESS_DIR, "profiles.json"), "utf8"));
const model = cfg.models.find((m) => !modelFilter || m.label.includes(modelFilter)) ?? cfg.models[0];
let { cases } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../summary-cases.json"), "utf8"));
if (only) { const subs = only.split(","); cases = cases.filter((c) => subs.some((s) => c.name.includes(s))); }

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSummaryPrompt");
const USER = grab("defaultSummaryUserPrompt");
const renderUser = (action, narration) =>
  USER.replaceAll("<PLAYER ACTION>", action).replaceAll("<NARRATION>", narration);

// A rough sentence count: terminal .!? runs, ignoring a single trailing terminator.
const sentenceCount = (s) => (s.trim().replace(/[.!?]+$/, "").match(/[.!?]+(\s|$)/g) || []).length + 1;
const wordSet = (s) => new Set((s.toLowerCase().match(/[a-z']+/g) || []));
// Capitalized words that could be a name: not sentence-initial, not "I", absent from the narration.
function nameLeaks(summary, narration, forbid) {
  const narWords = wordSet(narration);
  const leaks = new Set();
  // strip the very first word of each sentence (legitimately capitalized) before scanning.
  const scan = summary.replace(/(^|[.!?]\s+)([A-Z][a-z]+)/g, "$1");
  for (const m of scan.matchAll(/\b([A-Z][a-z]{2,})\b/g)) {
    const w = m[1];
    if (w === "I") continue;
    if (!narWords.has(w.toLowerCase())) leaks.add(w);
  }
  for (const f of forbid) {
    if (new RegExp(`\\b${f}\\b`, "i").test(summary)) leaks.add(f);
  }
  return [...leaks];
}

async function call(action, narration) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
  const res = await fetch(cfg.endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.modelName,
      messages: [{ role: "system", content: SYS }, { role: "user", content: renderUser(action, narration) }],
      max_tokens: 160,
      temperature: temp,
      ...extras,
      stream: false,
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

console.log(`Summary probe · ${model.label} · temp ${temp} · ${runs} run(s)/case\n`);
await call("warm up", "warm up").catch(() => {});
const agg = { pass: 0, total: 0, multiline: 0, tooLong: 0, notYou: 0, quotes: 0, nameLeak: 0, missedIdle: 0 };
for (const c of cases) {
  for (let r = 0; r < runs; r++) {
    const out = await call(c.action, c.narration);
    const fails = [];
    if (c.nothingNotable) {
      if (out.trim().toLowerCase().replace(/[.]$/, "") !== "nothing notable") { fails.push("MISSED-IDLE"); agg.missedIdle++; }
    } else {
      if (/\n/.test(out.trim())) { fails.push("MULTILINE"); agg.multiline++; }
      if (sentenceCount(out) > 2) { fails.push(`LONG(${sentenceCount(out)}s)`); agg.tooLong++; }
      if (!/^["*_]*you\b/i.test(out.trim())) { fails.push("NOT-YOU"); agg.notYou++; }
      if (/["“”]/.test(out)) { fails.push("QUOTES"); agg.quotes++; }
      const leaks = nameLeaks(out, c.narration, c.forbid || []);
      if (leaks.length) { fails.push(`NAME:${leaks.join("/")}`); agg.nameLeak++; }
    }
    const pass = fails.length === 0;
    agg.total++; if (pass) agg.pass++;
    console.log(`[${pass ? "PASS" : "FAIL"}] ${c.name}${runs > 1 ? ` #${r + 1}` : ""}${fails.length ? "  <" + fails.join(",") + ">" : ""}\n        ${JSON.stringify(out)}`);
  }
}
console.log(`\n${agg.pass}/${agg.total} clean · multiline=${agg.multiline} tooLong=${agg.tooLong} notYou=${agg.notYou} quotes=${agg.quotes} nameLeak=${agg.nameLeak} missedIdle=${agg.missedIdle}`);
