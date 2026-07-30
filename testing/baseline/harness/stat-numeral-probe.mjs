// STAT NUMERAL probe — does a raw fractional stat value in the narration context leak into the prose?
//
// With Measured Clock on, regen and stat code scale by the turn's measured hours, so a stat's value is
// routinely fractional and `buildStatContext` used to hand the model the full float:
//     Charge: 0.5833333333333333/100 (flickering)
// Two things were suspected: a numeral that precise is parrotable (small models echo exact context values
// into prose), and it is pure token waste. This probe measures both. The ONLY variable is the numeral —
// both arms render through the real `buildStatContext`, and the RAW arm substitutes the pre-fix float back
// into the finished line, so heading, ordering, descriptors and meanings are byte-identical between arms.
//
//   ROUND  — shipped: values and maxes rounded to whole numbers
//   RAW    — pre-fix: the unrounded float, exactly as it used to enter context
//
// Scenario base is the shared planning-cases.json (same world/location/cases as narration-probe), with a
// fractional stat block layered on. `whole-control` is the negative control: its stats are already integers,
// so the two arms produce IDENTICAL context — any metric that differs there is probe noise, not signal.
//
// Metrics per arm:
//   FLOAT     a long decimal (2+ places) anywhere in the prose — the direct parroting failure
//   VALUE     any of this case's exact stat numerals echoed (float form or rounded form)
//   PAIR      a bare `n/m` ratio in the prose (the context's own format, restated)
//   TABULATE  a `Name: number` stat line (the prompt forbids tabulating stats at all)
//   ptok      prompt_tokens reported by the endpoint — the token cost of the numeral, measured not guessed
//   words     narration length, as the regression check that nothing else moved
//
// Needs the `@/` alias, so run it through vite-node:
//   node_modules/.bin/vite-node testing/baseline/harness/stat-numeral-probe.mjs -- --model default \
//     --endpoint https://api.lyonade.net/v1/chat/completions --runs 3

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStatContext } from "@/lib/statContext";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const only = argVal("--only");
const runs = Number(argVal("--runs", "3"));
const maxTokens = Number(argVal("--max", "400"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const seedBase = Number(argVal("--seed", "20260729"));

const { world, playerTrait, location, cases } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSystemPrompt");

const MARKDOWN_ON = `## Formatting
- Write immersive, flowing prose - never a list, menu, or table.
- Reach for Markdown emphasis where it genuinely lands: **bold** the single most important noun of the moment (a threat, a key object, a revealed name) and *italicize* a sharp inner thought, sound, or stressed word - because the moment earns it, not to fill a quota.`;

const PIECES = { values: true, status: true, meaning: true };

// A stat block a Measured-Clock game really produces: a 1/hour regen after a 35-minute turn, a stat code
// result, and an AI-moved value that landed on a half. `whole` stats are the negative control.
const stat = (name, value, max, description, low, high) => ({
  id: name.toLowerCase(), name, type: "number", description, min: 0, max, value, regen: 0,
  descriptors: [{ id: "lo", threshold: 40, description: low }, { id: "hi", threshold: 100, description: high }],
});
const FRACTIONAL = [
  stat("Charge", 35 / 60, 100, "Residual power in your handpiece.", "flickering", "humming"),
  stat("Resolve", 85.5, 90, "Composure under pressure.", "shaken", "steady"),
  stat("Coin", 4, 20, "Money on hand.", "nearly broke", "getting by"),
];
const WHOLE = FRACTIONAL.map((s) => ({ ...s, value: Math.round(s.value), max: Math.round(s.max) }));

// The RAW arm reproduces the pre-fix format by substituting each stat's float back into the real builder's
// output. Rebuilding the line by hand would risk differing in a second way; this cannot.
const rawify = (rendered, stats) => {
  let out = rendered;
  for (const s of stats) {
    out = out.replace(
      `**${s.name}:** ${Math.round(s.value)}/${Math.round(s.max)}`,
      `**${s.name}:** ${s.value}/${s.max}`,
    );
  }
  return out;
};

const ARMS = ["ROUND", "RAW"];
const statBlock = (arm, stats) => {
  const rendered = buildStatContext(stats, PIECES, "markdown");
  return arm === "RAW" ? rawify(rendered, stats) : rendered;
};

const renderEntities = (entities) =>
  entities?.length
    ? entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n")
    : "N/A";

const renderSys = (c, arm) =>
  SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON)
    .replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", statBlock(arm, c.stats))
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", renderEntities(c.reachableEntities))
    .replaceAll("<DICTIONARY>", "N/A");

async function call(sys, messages, seed) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, ...messages],
      max_tokens: maxTokens, stream: false, seed,
      reasoning_effort: "none", // native-reasoning models otherwise route everything to `reasoning`
      // narration is unpinned in promptSamplers — send no temperature, the endpoint's own config applies
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return {
    text: (j.choices?.[0]?.message?.content ?? "").trim(),
    ptok: j.usage?.prompt_tokens ?? 0,
  };
}

const FLOAT_RE = /\d+\.\d{2,}/;
const PAIR_RE = /\b\d+\s*\/\s*\d+\b/;

// Numerals this case could echo: the float, its rounded form, and the max. Single digits are excluded —
// "two guards" and a stat of 4 collide constantly, and counting that as an echo would drown the signal.
const echoes = (text, stats) => {
  const hits = [];
  for (const s of stats) {
    const forms = [String(s.value), String(Math.round(s.value))];
    for (const f of new Set(forms)) {
      if (f.length > 1 && new RegExp(`(?<![\\d.])${f.replace(".", "\\.")}(?![\\d])`).test(text)) {
        hits.push(`${s.name}=${f}`);
      }
    }
  }
  return hits;
};

const TABULATE_RE = /(^|\n)\s*[-*]?\s*\**(charge|resolve|coin|hp|health|stat)\**\s*:?\s*[+-]?\d/i;
const words = (t) => t.split(/\s+/).filter(Boolean).length;

const pick = cases.filter((c) => !only || c.name.includes(only));
// Every case runs the fractional block; one extra case is the whole-number negative control.
const RUN_CASES = [
  ...pick.map((c) => ({ ...c, stats: FRACTIONAL })),
  { ...pick[0], name: "whole-control", stats: WHOLE },
];

console.log(`Stat numeral probe · ${endpoint} · model "${model}" · ${RUN_CASES.length} case(s) × ${runs} run(s) × 2 arms`);
console.log(`\nROUND stat block:\n${statBlock("ROUND", FRACTIONAL)}`);
console.log(`\nRAW stat block:\n${statBlock("RAW", FRACTIONAL)}\n`);

await call(renderSys(RUN_CASES[0], "ROUND"), [{ role: "user", content: "warm up" }], seedBase).catch(() => {});

const agg = {};
for (const arm of ARMS) agg[arm] = { n: 0, float: 0, value: 0, pair: 0, tab: 0, ptok: 0, words: 0, err: 0 };
const rows = [];

for (const c of RUN_CASES) {
  for (let r = 0; r < runs; r++) {
    const seed = seedBase + r; // paired seeds: the arms differ only by the numeral
    const row = { case: c.name, run: r + 1 };
    for (const arm of ARMS) {
      const a = agg[arm];
      a.n++;
      try {
        const { text, ptok } = await call(renderSys(c, arm), [
          { role: "assistant", content: c.prevNarration },
          { role: "user", content: c.action },
        ], seed);
        const hits = echoes(text, c.stats);
        const float = FLOAT_RE.test(text);
        const pair = PAIR_RE.test(text);
        const tab = TABULATE_RE.test(text);
        if (float) a.float++;
        if (hits.length) a.value++;
        if (pair) a.pair++;
        if (tab) a.tab++;
        a.ptok += ptok;
        a.words += words(text);
        row[arm] = { float, hits, pair, tab, ptok, words: words(text), text };
      } catch (e) {
        a.err++;
        row[arm] = { err: String(e.message || e) };
      }
    }
    rows.push(row);
    const cell = (d) => d.err ? "ERR" : [d.float ? "FLOAT" : "", d.hits.length ? `VAL(${d.hits.join(",")})` : "", d.pair ? "PAIR" : "", d.tab ? "TAB" : ""].filter(Boolean).join(",") || "clean";
    console.log(`${c.name} #${r + 1}  ROUND: ${cell(row.ROUND)}  |  RAW: ${cell(row.RAW)}`);
  }
}

const pct = (n, d) => d ? `${((n / d) * 100).toFixed(0)}%` : "—";
console.log(`\n| metric | ${ARMS.join(" | ")} |`);
console.log(`|---|${ARMS.map(() => "---").join("|")}|`);
const line = (label, fn) => console.log(`| ${label} | ${ARMS.map((a) => fn(agg[a])).join(" | ")} |`);
line("runs", (a) => a.n);
line("errors", (a) => a.err);
line("FLOAT in prose", (a) => `${a.float} (${pct(a.float, a.n - a.err)})`);
line("VALUE echoed", (a) => `${a.value} (${pct(a.value, a.n - a.err)})`);
line("PAIR (n/m) in prose", (a) => `${a.pair} (${pct(a.pair, a.n - a.err)})`);
line("stat TABULATION", (a) => `${a.tab} (${pct(a.tab, a.n - a.err)})`);
line("avg prompt_tokens", (a) => (a.n - a.err ? (a.ptok / (a.n - a.err)).toFixed(1) : "—"));
line("avg words out", (a) => (a.n - a.err ? (a.words / (a.n - a.err)).toFixed(1) : "—"));

const ctlRows = rows.filter((r) => r.case === "whole-control");
const ctlDiff = ctlRows.filter((r) => !r.ROUND?.err && !r.RAW?.err && r.ROUND.text !== r.RAW.text).length;
console.log(`\nnegative control (whole-control, arms render identical context): ${ctlRows.length - ctlDiff}/${ctlRows.length} runs matched byte-for-byte.`);
console.log(ctlDiff ? "  → endpoint is nondeterministic at this seed; read the arm deltas above as noisy, not exact." : "  → deterministic at this seed, so arm deltas above are the numeral's effect.");
