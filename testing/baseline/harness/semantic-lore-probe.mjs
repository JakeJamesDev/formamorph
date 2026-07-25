// Semantic-lore probe — tunes/validates SEMANTIC_LORE_THRESHOLD (src/lib/semanticDictionary.ts) against
// ../semantic-lore-cases.json: dictionary entries + actions labeled with the entries that SHOULD fire by
// meaning. Deterministic (embeddings only, no LLM). For every candidate threshold it reports precision
// (fired ∧ expected / fired) and recall (fired ∧ expected / expected), marking the shipped value's row.
// Positive actions must share no keyword with their expected entry — asserted up front, so a "hit" can
// only come from meaning, never from a literal keyword the keyword pass would have caught anyway.
//
// Usage:  node semantic-lore-probe.mjs [--cap 3] [--sweep 0.25,0.3,0.35,0.4,0.45,0.5,0.55]
//                                      [--mirror-names] [--embed legacy|deduped|deduped-list] [--matrix]
//
// `--mirror-names` rewrites every entry's name to its own joined keys, reproducing an AUTHORED world (the
// World Editor mirrored name←keywords until the fields were decoupled). The shipped fixture has distinct
// names, which models an IMPORTED lorebook instead — so without this flag the dedupe arm is a no-op and
// the probe would report "no change" while proving nothing.
//
// `--embed` picks the entry embed strategy:
//   legacy       — name — keys — value; the pre-fix behavior, kept as the baseline to measure against
//                  (in an authored world the name duplicated the keys, so they were embedded twice)
//   deduped      — SHIPPED: the name is dropped whenever it equals the joined keys (mirrors entryEmbedText)
//   deduped-list — dropped only when it duplicates a MULTI-keyword list; rejected (see embedTextFor)
//
// `--matrix` runs every {authored,imported} × arm combination and prints each arm's delta vs legacy.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const ARMS = ["legacy", "deduped", "deduped-list"];

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const cap = Number(argVal("--cap", "3"));
const sweep = argVal("--sweep", "0.25,0.3,0.35,0.4,0.45,0.5,0.55").split(",").map(Number);
const matrix = args.includes("--matrix");
const mirrorNames = args.includes("--mirror-names");
const embedArm = argVal("--embed", "legacy");
if (!ARMS.includes(embedArm)) throw new Error(`--embed must be one of ${ARMS.join("|")}`);

const { entries, actions } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../semantic-lore-cases.json"), "utf8"));

const semSrc = await readFile(path.join(REPO_ROOT, "src/lib/semanticDictionary.ts"), "utf8");
const SHIPPED = Number(semSrc.match(/SEMANTIC_LORE_THRESHOLD = ([\d.]+)/)[1]);
const relevanceSrc = await readFile(path.join(REPO_ROOT, "src/lib/memoryRelevance.ts"), "utf8");
const MODEL_ID = relevanceSrc.match(/EMBEDDING_MODEL_ID = '([^']+)'/)[1];

// Guard: a positive case must not contain any of its expected entry's keywords (else it tests nothing).
for (const a of actions) {
  for (const id of a.expect) {
    const entry = entries.find((e) => e.id === id);
    for (const key of (entry.key ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean)) {
      if (a.text.toLowerCase().includes(key)) {
        throw new Error(`case "${a.name}" contains keyword "${key}" of expected entry "${id}" — rewrite the action`);
      }
    }
  }
}

/** An entry as an authored world holds it: the editor mirrored `name` from the keywords. */
const asAuthored = (e) => ({ ...e, name: (e.key ?? []).join(", ") });

/**
 * Embed text per arm.
 *   legacy       — the shipped entryEmbedText: name — keys — value.
 *   deduped      — drop the name whenever it equals the joined keys.
 *   deduped-list — drop it only when it duplicates a MULTI-keyword list, which is what the old editor's
 *                  name←keywords mirror produced. A name equal to a single keyword ("Weck" keyed "Weck")
 *                  is a real name, not a mirrored list, and stays — dropping it costs the entry the
 *                  repetition that made it specific.
 */
const embedTextFor = (arm) => (e) => {
  const keys = (e.key ?? []).join(", ");
  const mirrors = e.name === keys && (arm === "deduped" || (e.key ?? []).length > 1);
  const name = arm.startsWith("deduped") && mirrors ? "" : e.name;
  return [name, keys, (e.value || "").slice(0, 1000)].filter(Boolean).join(" — ");
};


console.log(`Loading ${MODEL_ID} (q8)…`);
const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
const embed = async (texts) => {
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, r) => out.data.slice(r * d, (r + 1) * d));
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const actionVecs = await embed(actions.map((a) => a.text));

/** Precision/recall for one arm's entry vectors at one threshold, under the cap. */
function score(entryVecs, thr) {
  let tp = 0, fp = 0, fn = 0, fired = 0;
  for (let ai = 0; ai < actions.length; ai++) {
    const a = actions[ai];
    const hits = entries
      .map((e, ei) => ({ id: e.id, sim: cos(actionVecs[ai], entryVecs[ei]) }))
      .filter((s) => s.sim >= thr)
      .sort((x, y) => y.sim - x.sim)
      .slice(0, cap)
      .map((s) => s.id);
    fired += hits.length;
    for (const h of hits) (a.expect.includes(h) ? tp++ : fp++);
    for (const want of a.expect) if (!hits.includes(want)) fn++;
  }
  return {
    fired,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 1,
  };
}

/** Embed one arm's entries. `population` is 'authored' (name mirrors keys) or 'imported' (distinct names). */
async function armVectors(population, arm) {
  const source = population === "authored" ? entries.map(asAuthored) : entries;
  return embed(source.map(embedTextFor(arm)));
}

const pct = (x) => `${(100 * x).toFixed(0).padStart(3)}%`;

function printSweep(label, entryVecs) {
  console.log(`\n${label}`);
  console.log(`  thr    fired  precision  recall`);
  for (const thr of sweep) {
    const { fired, precision, recall } = score(entryVecs, thr);
    const mark = thr === SHIPPED ? "  ← shipped" : "";
    console.log(`  ${thr.toFixed(2)}   ${String(fired).padStart(3)}    ${pct(precision)}      ${pct(recall)}${mark}`);
  }
}

if (!matrix) {
  const population = mirrorNames ? "authored" : "imported";
  const entryVecs = await armVectors(population, embedArm);

  const sample = population === "authored" ? asAuthored(entries[0]) : entries[0];
  console.log(`\nEmbed text (${population} · ${embedArm}), first entry:`);
  console.log(`  ${embedTextFor(embedArm)(sample)}`);

  console.log(`\nPer-action similarities (■ = expected):`);
  actions.forEach((a, ai) => {
    const sims = entries.map((e, ei) => ({ id: e.id, sim: cos(actionVecs[ai], entryVecs[ei]) }));
    sims.sort((x, y) => y.sim - x.sim);
    const top = sims.slice(0, 3).map((s) => `${a.expect.includes(s.id) ? "■" : " "}${s.id}:${s.sim.toFixed(2)}`).join("  ");
    console.log(`  ${a.name.padEnd(20)} ${top}`);
  });

  printSweep(`Threshold sweep (cap ${cap}) · ${population} · ${embedArm}:`, entryVecs);
} else {
  // Full matrix. `authored` is the population the change targets; `imported` is the regression control —
  // but note it is NOT dedupe-free: an entry whose single keyword equals its name (e.g. "Weck") mirrors too.
  const vecs = {};
  for (const population of ["authored", "imported"]) {
    for (const arm of ARMS) {
      vecs[`${population}/${arm}`] = await armVectors(population, arm);
      printSweep(`Threshold sweep (cap ${cap}) · ${population} · ${arm}:`, vecs[`${population}/${arm}`]);
    }
  }

  const sign = (x) => `${x >= 0 ? "+" : ""}${x.toFixed(0)}`.padStart(4);
  for (const deltaArm of ARMS.filter((a) => a !== "legacy")) {
    console.log(`\n\nlegacy → ${deltaArm} delta (percentage points):`);
    for (const population of ["authored", "imported"]) {
      console.log(`\n  ${population}:`);
      console.log(`  thr    Δprecision  Δrecall   verdict`);
      for (const thr of sweep) {
        const before = score(vecs[`${population}/legacy`], thr);
        const after = score(vecs[`${population}/${deltaArm}`], thr);
        const dp = 100 * (after.precision - before.precision);
        const dr = 100 * (after.recall - before.recall);
        // The agreed bar: the new arm must not lose ground on either metric.
        const verdict = dp >= 0 && dr >= 0 ? (dp || dr ? "better" : "same") : "REGRESSION";
        const mark = thr === SHIPPED ? "  ← shipped" : "";
        console.log(`  ${thr.toFixed(2)}      ${sign(dp)}       ${sign(dr)}    ${verdict}${mark}`);
      }
    }
  }

  // How many fixture entries each arm actually rewrites — the size of the affected set behind each delta.
  console.log(`\n\nEntries rewritten vs legacy:`);
  for (const population of ["authored", "imported"]) {
    const src = population === "authored" ? entries.map(asAuthored) : entries;
    for (const arm of ARMS.filter((a) => a !== "legacy")) {
      const changed = src.filter((e) => embedTextFor(arm)(e) !== embedTextFor("legacy")(e));
      console.log(`  ${population.padEnd(9)} ${arm.padEnd(13)} ${changed.length}/${src.length}  ${changed.map((e) => e.id).join(", ")}`);
    }
  }
}
