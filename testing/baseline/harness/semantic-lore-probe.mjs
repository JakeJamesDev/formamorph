// Semantic-lore probe — tunes/validates SEMANTIC_LORE_THRESHOLD (src/lib/semanticDictionary.ts) against
// ../semantic-lore-cases.json: dictionary entries + actions labeled with the entries that SHOULD fire by
// meaning. Deterministic (embeddings only, no LLM). For every candidate threshold it reports precision
// (fired ∧ expected / fired) and recall (fired ∧ expected / expected), marking the shipped value's row.
// Positive actions must share no keyword with their expected entry — asserted up front, so a "hit" can
// only come from meaning, never from a literal keyword the keyword pass would have caught anyway.
//
// Usage:  node semantic-lore-probe.mjs [--cap 3] [--sweep 0.25,0.3,0.35,0.4,0.45,0.5,0.55]
//                                      [--mirror-names] [--embed legacy|deduped|deduped-list]
//                                      [--matrix] [--holdout]
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
//
// `--holdout` cross-validates the THRESHOLD CHOICE: a stratified 2-fold split of the actions (the entry
// pool stays whole), tuning on one fold and scoring on the other. A threshold fitted to the cases rather
// than the phenomenon shows up as a large tune→held-out drop, or as the folds picking different values.

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
const holdout = args.includes("--holdout");
const mirrorNames = args.includes("--mirror-names");
const embedArm = argVal("--embed", "legacy");
const selectRule = argVal("--select", "precision");
if (!["precision", "f1"].includes(selectRule)) throw new Error(`--select must be precision|f1`);
if (!ARMS.includes(embedArm)) throw new Error(`--embed must be one of ${ARMS.join("|")}`);

// Cases carry their own actions. They either inline the entries (the original synthetic fixture) or name a
// world file to pull them from — a real authored world is the stronger test, since its entries were written
// as lore rather than as test material.
const casesFile = argVal("--cases", "semantic-lore-cases.json");
const cases = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "..", casesFile), "utf8"));
const actions = cases.actions;
const worldFile = argVal("--world", cases.world ?? null);
const entries = worldFile
  ? JSON.parse(await readFile(path.resolve(HARNESS_DIR, "..", worldFile), "utf8"))
      .dictionaries.flatMap((b) => b.entries)
  : cases.entries;
if (worldFile) console.log(`Entries from ${worldFile}: ${entries.length} · cases from ${casesFile}: ${actions.length}`);

// Every expected id must exist, or a typo silently becomes an unreachable recall miss.
for (const a of actions) {
  for (const id of a.expect) {
    if (!entries.some((e) => e.id === id || e.id === `dict-${id}`)) throw new Error(`case "${a.name}" expects unknown entry "${id}"`);
  }
}
// Cases may reference entries by bare id; normalize to whatever the entry actually carries.
const resolveId = (id) => (entries.some((e) => e.id === id) ? id : `dict-${id}`);
for (const a of actions) a.expect = a.expect.map(resolveId);

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

/** Every action index, the default scoring set (a fold passes its own subset). */
const ALL_IDX = actions.map((_, i) => i);

/** Precision/recall for one arm's entry vectors at one threshold, over `idx`, under the cap. */
function score(entryVecs, thr, idx = ALL_IDX) {
  let tp = 0, fp = 0, fn = 0, fired = 0;
  for (const ai of idx) {
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
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  return { fired, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
}

/** Embed one arm's entries. `population` is 'authored' (name mirrors keys) or 'imported' (distinct names). */
async function armVectors(population, arm) {
  const source = population === "authored" ? entries.map(asAuthored) : entries;
  return embed(source.map(embedTextFor(arm)));
}

const pct = (x) => `${(100 * x).toFixed(0).padStart(3)}%`;

/**
 * Deterministic stratified 2-fold split of the ACTIONS. The 20-entry pool stays whole in both folds —
 * it is the world, and shrinking it would change how many false fires are even possible, making the two
 * halves incomparable. Positives and negatives are alternated separately (after a name sort) so each fold
 * gets a balanced mix, and the assignment is reproducible with no RNG.
 */
function actionFolds() {
  const fold = [[], []];
  for (const cls of [true, false]) {
    actions
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => (a.expect.length > 0) === cls)
      .sort((x, y) => x.a.name.localeCompare(y.a.name))
      .forEach(({ i }, n) => fold[n % 2].push(i));
  }
  return fold.map((idx) => idx.sort((x, y) => x - y));
}

/**
 * The tuning rule, applied to one fold. Two are supported because they answer different product questions:
 *   precision — the LOWEST threshold reaching 100% precision, maximizing recall under that. What the shipped
 *               value was originally chosen by; only reachable when the entry pool is small enough that a
 *               clean separation exists at all.
 *   f1        — the threshold with the best harmonic mean. The only workable rule once the pool is large
 *               enough that no threshold is perfectly clean.
 * Stated explicitly so the held-out check measures the actual selection procedure, not a hindsight pick.
 */
function selectThreshold(entryVecs, idx, grid, rule = selectRule) {
  if (rule === "f1") {
    let best = null;
    for (const thr of grid) {
      const s = score(entryVecs, thr, idx);
      if (!best || s.f1 > best.f1) best = { thr, f1: s.f1 };
    }
    return best ? best.thr : null;
  }
  const ok = grid.filter((thr) => score(entryVecs, thr, idx).precision >= 1);
  return ok.length ? ok[0] : null;
}

function printSweep(label, entryVecs) {
  console.log(`\n${label}`);
  console.log(`  thr    fired  precision  recall     F1`);
  const rows = sweep.map((thr) => ({ thr, ...score(entryVecs, thr) }));
  const best = Math.max(...rows.map((r) => r.f1));
  for (const { thr, fired, precision, recall, f1 } of rows) {
    const mark = (thr === SHIPPED ? "  ← shipped" : "") + (f1 === best ? "  ★ best F1" : "");
    console.log(`  ${thr.toFixed(2)}   ${String(fired).padStart(3)}    ${pct(precision)}      ${pct(recall)}   ${pct(f1)}${mark}`);
  }
}

if (holdout) {
  // Two-fold cross-validation of the SELECTION PROCEDURE. Tune the threshold on one fold, then score it
  // on the fold it never saw. A threshold fitted to the cases rather than to the phenomenon shows up as a
  // large tune→held-out drop, or as the two folds disagreeing on which threshold to pick.
  const [foldA, foldB] = actionFolds();
  const grid = Array.from({ length: 31 }, (_, i) => Number((0.25 + i * 0.01).toFixed(2)));
  const nPos = (idx) => idx.filter((i) => actions[i].expect.length).length;

  console.log(`\nStratified 2-fold split of ${actions.length} actions (entry pool whole in both):`);
  console.log(`  fold A: ${foldA.length} actions (${nPos(foldA)} positive)  ${foldA.map((i) => actions[i].name).join(", ")}`);
  console.log(`  fold B: ${foldB.length} actions (${nPos(foldB)} positive)  ${foldB.map((i) => actions[i].name).join(", ")}`);
  const ruleText = selectRule === "f1" ? "best F1" : "lowest threshold reaching 100% precision";
  console.log(`\nSelection rule (--select ${selectRule}): ${ruleText}, scanned ${grid[0]}–${grid[grid.length - 1]}.`);

  for (const population of ["authored", "imported"]) {
    const entryVecs = await armVectors(population, embedArm);
    console.log(`\n\n${population} · ${embedArm}`);
    console.log(`  tuned on   thr     tune P/R        held-out P/R     Δprecision  Δrecall`);
    for (const [name, tune, held] of [["A", foldA, foldB], ["B", foldB, foldA]]) {
      const thr = selectThreshold(entryVecs, tune, grid);
      if (thr === null) { console.log(`  fold ${name}      —     no threshold reaches 100% precision`); continue; }
      const t = score(entryVecs, thr, tune);
      const h = score(entryVecs, thr, held);
      const sign = (x) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(0)}`.padStart(5);
      console.log(
        `  fold ${name}     ${thr.toFixed(2)}   ${pct(t.precision)} / ${pct(t.recall)}   ` +
        `${pct(h.precision)} / ${pct(h.recall)}    ${sign(h.precision - t.precision)}      ${sign(h.recall - t.recall)}`,
      );
    }
    // The shipped value judged on each fold separately — if it only looks good on one, it is fitted to it.
    console.log(`\n  shipped ${SHIPPED} scored per fold:`);
    for (const [name, idx] of [["A", foldA], ["B", foldB]]) {
      const s = score(entryVecs, SHIPPED, idx);
      console.log(`    fold ${name}: ${pct(s.precision)} precision / ${pct(s.recall)} recall`);
    }
  }
} else if (!matrix) {
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
