// Stat-language probe — A/B for the stat-updates pass in a NON-ENGLISH world.
//
// Arm "rider" is the shipped-until-now form: the rendered stat-updates system prompt with
// `\n Please write in english` appended whenever the AI Language setting is not English. Arm "none" is the
// new form: nothing appended, for any language. The English arm was byte-identical either way, so this
// probe only runs the arm the change actually moves.
//
// The point of the metric is the app's real contract: `parseStatUpdates` lowercases the name before the
// colon and `applyAiStatChanges` matches it against the authored stat's own name. In a French world the
// authored names ARE French, so a reply that answers "Vigor: -8" instead of "Vigueur: -8" parses fine and
// then applies to nothing at all — a silent no-op. So the headline number is APPLIED: did the stat the case
// says moved actually come back under a name the app can match, in the right direction.
//
// Fixture: ../stat-language-cases.json (French world, French stat names/descriptions, French narration).
// The stats block is rendered exactly as the app's `<STATS DESCRIPTION|numbers.meaning.markdown>` token does.
//
// Shipped verdict (the run that removed the rider) — French, temp 0.2:
//   cloud default, 72 runs/arm:  applied 82% → 83% · unmatched 0% → 0% · spurious 17% → 17% · empty 0% → 0%
//   Cydonia 24B, 18 runs/arm:    applied 100% → 100%, every other metric identical
// So the deletion is measured COSTLESS rather than a win: neither tier translated a stat name under the
// rider, so it was inert here, and nothing regressed without it. The "deroute" case applies 0% on cloud in
// BOTH arms — that model does not read a failed survey as a Volonté loss; identical across arms, so it
// prices the case, not the change.
//
// Usage:
//   node stat-language-probe.mjs                                   # cloud default endpoint, 12 runs/case/arm
//   node stat-language-probe.mjs --endpoint http://127.0.0.1:1234/v1/chat/completions \
//                                --model cydonia-24b-v4.3@q4_k_m --runs 3 --concurrency 1

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "12"));
const concurrency = Number(argVal("--concurrency", "4"));
const language = argVal("--language", "French");
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const verbose = args.includes("--verbose");

const { world, stats, cases } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../stat-language-cases.json"), "utf8"),
);

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  // The stat-updates prompt carries no language chip; the strip keeps this grabber identical to its siblings.
  return source.slice(from, source.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd();
};
const SYS = grab("defaultStatUpdatesPrompt");
const USER = grab("defaultStatUpdatesUserPrompt");

const statsBlock = stats
  .map((s) => `- **${s.name}:** ${s.value}/${s.max}${s.description ? ` - ${s.description}` : ""}`)
  .join("\n");
const baseSys = SYS.replaceAll("<WORLD DESCRIPTION>", world)
  .replaceAll("<STATS DESCRIPTION|numbers.meaning.markdown>", statsBlock)
  .replaceAll("<TRAITS DESCRIPTION|markdown>", "N/A")
  .replaceAll("<NOTES>", "N/A");

/** The two arms: the builder's whole difference is what it appends for a non-English language. */
const ARMS = {
  rider: (sys) => `${sys}\n Please write in english`,
  none: (sys) => sys,
};

const AUTHORED = new Set(stats.map((s) => s.name.toLowerCase()));

// Faithful mirror of lib/statChanges `parseStatUpdates` — keep in sync with it. Name-match on the text
// before the colon, first number after it, value/max echoes skipped.
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

const dir = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

async function call(sys, narration) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    // The app pins the stat pass at temp 0.2 (lib/promptSamplers); the probe sends the same.
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: USER.replaceAll("<NARRATION>", narration) }],
      max_tokens: 200,
      temperature: 0.2,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

/** Run `jobs` with at most `concurrency` in flight, so a local single-GPU run isn't thrashed. */
async function pool(jobs) {
  const out = [];
  for (let i = 0; i < jobs.length; i += concurrency) {
    out.push(...await Promise.all(jobs.slice(i, i + concurrency).map((j) => j().catch((e) => ({ error: String(e.message || e) })))));
  }
  return out;
}

// Self-check: the scorer has to place a known-good French reply and reject a translated one, or the numbers
// below mean nothing.
const CHECK_GOOD = parse("Vigueur: -8");
const CHECK_BAD = parse("Vigor: -8");
const scorerOk = AUTHORED.has(Object.keys(CHECK_GOOD)[0]) && !AUTHORED.has(Object.keys(CHECK_BAD)[0]);
console.log(`Scorer self-check: ${scorerOk ? "✓ authored name matched, translated name rejected" : "✗ BROKEN — numbers below are void"}`);

console.log(`\nStat-language probe · ${endpoint} · model "${model}" · language "${language}" · ${runs} run(s)/case/arm · ${cases.length} cases\n`);

const rows = [];
for (const [armName, arm] of Object.entries(ARMS)) {
  const sys = arm(baseSys);
  for (const c of cases) {
    const results = await pool(Array.from({ length: runs }, () => () => call(sys, c.narration)));
    for (const raw of results) {
      if (raw && raw.error) { rows.push({ arm: armName, case: c.name, error: raw.error }); continue; }
      const parsed = parse(raw);
      const allow = new Set((c.allow || []).map((x) => x.toLowerCase()));
      const expected = Object.entries(c.expect).map(([name, d]) => [name.toLowerCase(), d]);
      // APPLIED: the expected stat came back under a name the app can match, moving the right way.
      const applied = expected.every(([k, d]) => parsed[k] !== undefined && dir(parsed[k]) === d);
      // UNMATCHED: at least one key the app would silently drop — the translation failure mode.
      const unmatched = Object.keys(parsed).filter((k) => !AUTHORED.has(k));
      // SPURIOUS: a trap stat moved. The regression check — removing the rider must not loosen relevance.
      const spurious = Object.entries(parsed).filter(
        ([k, v]) => v !== 0 && AUTHORED.has(k) && !allow.has(k) && !expected.some(([e]) => e === k),
      );
      rows.push({
        arm: armName,
        case: c.name,
        applied,
        unmatched: unmatched.length > 0,
        spurious: spurious.length > 0,
        empty: Object.keys(parsed).length === 0,
        unmatchedKeys: unmatched,
        raw,
      });
      if (verbose) console.log(`[${armName}/${c.name}] applied=${applied} unmatched=${JSON.stringify(unmatched)} :: ${JSON.stringify(raw)}`);
    }
  }
}

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : "-");
console.log("\n| arm | n | applied | unmatched name | spurious stat | empty | errors |");
console.log("|---|---|---|---|---|---|---|");
for (const armName of Object.keys(ARMS)) {
  const all = rows.filter((r) => r.arm === armName);
  const ok = all.filter((r) => !r.error);
  console.log(
    `| ${armName} | ${ok.length} | ${pct(ok.filter((r) => r.applied).length, ok.length)} | ` +
    `${pct(ok.filter((r) => r.unmatched).length, ok.length)} | ${pct(ok.filter((r) => r.spurious).length, ok.length)} | ` +
    `${pct(ok.filter((r) => r.empty).length, ok.length)} | ${all.length - ok.length} |`,
  );
}

console.log("\nPer case (applied rate):");
console.log(`| case | ${Object.keys(ARMS).join(" | ")} |`);
console.log(`|---|${Object.keys(ARMS).map(() => "---").join("|")}|`);
for (const c of cases) {
  const cells = Object.keys(ARMS).map((armName) => {
    const ok = rows.filter((r) => r.arm === armName && r.case === c.name && !r.error);
    return pct(ok.filter((r) => r.applied).length, ok.length);
  });
  console.log(`| ${c.name} | ${cells.join(" | ")} |`);
}

const names = [...new Set(rows.flatMap((r) => r.unmatchedKeys || []))];
if (names.length) console.log(`\nNames the app could not match: ${names.join(", ")}`);
