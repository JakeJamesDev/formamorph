// Semantic-lore probe — tunes/validates SEMANTIC_LORE_THRESHOLD (src/lib/semanticDictionary.ts) against
// ../semantic-lore-cases.json: dictionary entries + actions labeled with the entries that SHOULD fire by
// meaning. Deterministic (embeddings only, no LLM). For every candidate threshold it reports precision
// (fired ∧ expected / fired) and recall (fired ∧ expected / expected), marking the shipped value's row.
// Positive actions must share no keyword with their expected entry — asserted up front, so a "hit" can
// only come from meaning, never from a literal keyword the keyword pass would have caught anyway.
//
// Usage:  node semantic-lore-probe.mjs [--cap 3] [--sweep 0.25,0.3,0.35,0.4,0.45,0.5,0.55]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const cap = Number(argVal("--cap", "3"));
const sweep = argVal("--sweep", "0.25,0.3,0.35,0.4,0.45,0.5,0.55").split(",").map(Number);

const { entries, actions } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../semantic-lore-cases.json"), "utf8"));

const semSrc = await readFile(path.join(REPO_ROOT, "src/lib/semanticDictionary.ts"), "utf8");
const SHIPPED = Number(semSrc.match(/SEMANTIC_LORE_THRESHOLD = ([\d.]+)/)[1]);
const relevanceSrc = await readFile(path.join(REPO_ROOT, "src/lib/memoryRelevance.ts"), "utf8");
const MODEL_ID = relevanceSrc.match(/EMBEDDING_MODEL_ID = '([^']+)'/)[1];

// Guard: a positive case must not contain any of its expected entry's keywords (else it tests nothing).
for (const a of actions) {
  for (const id of a.expect) {
    const entry = entries.find((e) => e.id === id);
    for (const key of entry.key.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)) {
      if (a.text.toLowerCase().includes(key)) {
        throw new Error(`case "${a.name}" contains keyword "${key}" of expected entry "${id}" — rewrite the action`);
      }
    }
  }
}

// Embed text mirrors entryEmbedText: name — keys — content (cap is irrelevant at these sizes).
console.log(`Loading ${MODEL_ID} (q8)…`);
const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
const embed = async (texts) => {
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, r) => out.data.slice(r * d, (r + 1) * d));
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const entryVecs = await embed(entries.map((e) => [e.name, e.key, (e.value || "").slice(0, 1000)].filter(Boolean).join(" — ")));
const actionVecs = await embed(actions.map((a) => a.text));

// Per-action similarity table (the raw evidence the sweep summarizes).
console.log(`\nPer-action similarities (■ = expected):`);
actions.forEach((a, ai) => {
  const sims = entries.map((e, ei) => ({ id: e.id, sim: cos(actionVecs[ai], entryVecs[ei]) }));
  sims.sort((x, y) => y.sim - x.sim);
  const top = sims.slice(0, 3).map((s) => `${a.expect.includes(s.id) ? "■" : " "}${s.id}:${s.sim.toFixed(2)}`).join("  ");
  console.log(`  ${a.name.padEnd(20)} ${top}`);
});

console.log(`\nThreshold sweep (cap ${cap}):`);
console.log(`  thr    fired  precision  recall`);
for (const thr of sweep) {
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
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const mark = thr === SHIPPED ? "  ← shipped" : "";
  console.log(`  ${thr.toFixed(2)}   ${String(fired).padStart(3)}    ${(100 * precision).toFixed(0).padStart(3)}%      ${(100 * recall).toFixed(0).padStart(3)}%${mark}`);
}
