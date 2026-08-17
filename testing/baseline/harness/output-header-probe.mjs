// Output-header probe — A/B for giving the narration prompt's closing contract its own `## Output` header.
//
// Arm "flat" is the shipped-until-now form: the contract paragraph sits directly under `## Foreground Lore`,
// so the section that means "here is this turn's lore" also contains "output only the story prose, never a
// question, never a list". Arm "header" puts `## Output` between them, so Foreground Lore ends at the
// dictionary chip. The hypothesis under test is that a contract filed under a lore heading reads as lore.
//
// Both arms fire the REAL defaultSystemPrompt over the tracked planning-cases fixture with a lore block
// present (an empty Foreground Lore section would make the two arms nearly the same prompt). The metrics are
// the contract's own job, scored by pattern, never by asking a model:
//   OFFERS-CHOICES   a question to the player, an options menu, or a numbered/bulleted action list
//   TRAILING-QUESTION the reply's last sentence is a question — the softest form of the same failure
//   STAT-TABULATION  a stat name and a number, which a separate pass owns
//   LABELLED         a heading or "Narration:"-style label the contract forbids
//
// Shipped verdict (the run that added the header) — no measurable effect on either tier:
//   cloud default, 108 runs/arm:  100% clean both arms, 0% on every flag, 81 → 84 words
//   Cydonia 24B, 81 runs/arm (3 batches of 27):  LABELLED 9% → 7% · OFFERS-CHOICES 0% → 4%
// Cydonia's OFFERS-CHOICES events were 3 runs, all in one batch and all on `reachable-not-present`; a third
// batch returned 0% on both arms, so it did not replicate. LABELLED fires in BOTH arms — Cydonia writes a
// markdown heading now and then whatever the section structure is, which is a model habit, not this change.
//
// Usage:
//   node output-header-probe.mjs                                   # cloud default endpoint, 12 runs/case/arm
//   node output-header-probe.mjs --endpoint http://127.0.0.1:1234/v1/chat/completions \
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
const maxTokens = Number(argVal("--max", "400"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");
const verbose = args.includes("--verbose");

const { world, playerTrait, location, cases } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  // Probes run English-only, where the language chip renders to nothing, and the arms that do test the
  // directive append their own wording — so the chip is stripped rather than left as a literal token.
  return source.slice(from, source.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd();
};
const SYS = grab("defaultSystemPrompt");
const OUTPUT_HEADER = "## Output\n";
if (!SYS.includes(OUTPUT_HEADER)) throw new Error("defaultSystemPrompt has no `## Output` header — arms are identical");

const MARKDOWN_ON = `## Formatting
- Write immersive, flowing prose - never a list, menu, or table.
- Reach for Markdown emphasis where it genuinely lands: **bold** the single most important noun of the moment (a threat, a key object, a revealed name) and *italicize* a sharp inner thought, sound, or stressed word - because the moment earns it, not to fill a quota.`;

// The section under test only exists when lore actually fired, so both arms get a real Foreground Lore block.
const LORE = `The Rope Ferry: The crossing is worked hand over hand along a tarred rope strung bank to bank. It carries four standing, or two and a handcart, and it will not run once the current picks up after rain.

The Landing Bell: A cracked bell on the leaning post is rung twice for a crossing and three times for trouble. Nobody has rung it three times in living memory.`;

const renderEntities = (entities) =>
  entities?.length
    ? entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n")
    : "N/A";

const renderSys = (c) =>
  SYS.replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady\n- **Coin:** light")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<NOTES>", "N/A")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", renderEntities(c.reachableEntities))
    .replaceAll("<DICTIONARY>", LORE)
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON);

/** The two arms: one line's difference, so anything measured here is that line. */
const ARMS = {
  flat: (sys) => sys.replace(OUTPUT_HEADER, ""),
  header: (sys) => sys,
};

const OPTIONS_RE = /\b(what (do|would|will) you (do|say)|choose one|choose from|your options?|options?:|pick one|what now)\b/i;
const LIST_RE = /^\s*(\d+[.)]|[-*])\s+.+$/m;
const LABEL_RE = /(^|\n)\s*(#{1,6}\s|\*\*?(narration|scene|story|turn)\*?\*?\s*:)/i;
const STAT_RE = /(^|\n)\s*[-*]?\s*(resolve|coin)\s*:?\s*[+-]?\d/i;

/** The contract's own violations, one flag each. */
function flags(text) {
  const f = [];
  const body = text.trim();
  if (OPTIONS_RE.test(body) || (LIST_RE.test(body) && /\?$/m.test(body))) f.push("OFFERS-CHOICES");
  if (/\?\s*$/.test(body)) f.push("TRAILING-QUESTION");
  if (STAT_RE.test(body)) f.push("STAT-TABULATION");
  if (LABEL_RE.test(body)) f.push("LABELLED");
  return f;
}

// Self-check: the scorer has to catch three planted violations and clear one clean passage, or the arm
// numbers below mean nothing.
const CHECK = [
  ["OFFERS-CHOICES", 'The boards creak under you. What do you do?'],
  // Unquoted: a question inside quoted dialogue is a character speaking, which the contract allows. Only a
  // question the narration itself puts to the player counts.
  ["TRAILING-QUESTION", "The boards creak under your weight. Will you risk the crossing?"],
  [null, 'She looks up from the lamp. "Are you the one they sent?"'],
  ["STAT-TABULATION", "You haul the rope in. \n\nResolve: -5"],
  ["LABELLED", "## Narration\nThe lamp swings on its post."],
  [null, 'The lamp swings on the leaning post, and Wren does not look up from it. "Nobody worth the asking," she says.'],
];
const checkOk = CHECK.every(([want, text]) => (want ? flags(text).includes(want) : flags(text).length === 0));
console.log(`Scorer self-check: ${checkOk ? "✓ every planted violation caught, clean passage clear" : "✗ BROKEN — numbers below are void"}`);
if (!checkOk) for (const [want, text] of CHECK) console.log(`  want ${want} → got ${JSON.stringify(flags(text))}`);

async function call(sys, c) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    // Narration is unpinned in the app — the endpoint's own sampler decides, as in play.
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "assistant", content: c.prevNarration },
        { role: "user", content: c.action },
      ],
      max_tokens: maxTokens,
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

console.log(`\nOutput-header probe · ${endpoint} · model "${model}" · ${runs} run(s)/case/arm · ${cases.length} cases\n`);

const rows = [];
for (const [armName, arm] of Object.entries(ARMS)) {
  for (const c of cases) {
    const sys = arm(renderSys(c));
    const results = await pool(Array.from({ length: runs }, () => () => call(sys, c)));
    for (const raw of results) {
      if (raw && raw.error) { rows.push({ arm: armName, case: c.name, error: raw.error }); continue; }
      const f = flags(raw);
      rows.push({ arm: armName, case: c.name, flags: f, words: raw.split(/\s+/).length });
      // Print what each flag actually matched, not just the reply's tail: a flag whose evidence you cannot
      // see is a flag you cannot tell from a scorer bug.
      if (verbose && f.length) {
        const hits = [
          ["OFFERS-CHOICES", raw.match(OPTIONS_RE)?.[0]],
          ["TRAILING-QUESTION", raw.trim().slice(-60)],
          ["STAT-TABULATION", raw.match(STAT_RE)?.[0]],
          ["LABELLED", raw.match(LABEL_RE)?.[0]],
        ].filter(([name]) => f.includes(name));
        console.log(`[${armName}/${c.name}] ${hits.map(([n, m]) => `${n}=${JSON.stringify(m)}`).join(" ")}`);
      }
    }
  }
}

const FLAGS = ["OFFERS-CHOICES", "TRAILING-QUESTION", "STAT-TABULATION", "LABELLED"];
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : "-");
console.log(`\n| arm | n | clean | ${FLAGS.join(" | ")} | words | errors |`);
console.log(`|---|---|---|${FLAGS.map(() => "---").join("|")}|---|---|`);
for (const armName of Object.keys(ARMS)) {
  const all = rows.filter((r) => r.arm === armName);
  const ok = all.filter((r) => !r.error);
  const cells = FLAGS.map((f) => pct(ok.filter((r) => r.flags.includes(f)).length, ok.length));
  const words = ok.length ? Math.round(ok.reduce((s, r) => s + r.words, 0) / ok.length) : 0;
  console.log(
    `| ${armName} | ${ok.length} | ${pct(ok.filter((r) => !r.flags.length).length, ok.length)} | ${cells.join(" | ")} | ${words} | ${all.length - ok.length} |`,
  );
}
