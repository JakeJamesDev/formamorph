// Diary-retrieve probe — validates DIARY_SIM_THRESHOLD (src/lib/semanticDiary.ts) on diary-shaped
// texts: first-person 1-2 sentence entries vs player actions (../semantic-diary-cases.json).
// Deterministic (embeddings only). Retrieval is per-character with a hard cap of 2, so the sweep uses
// cap 2 and reports precision (retrieved ∧ expected / retrieved) and recall per threshold, marking the
// shipped value. Positive actions must share no distinctive word with their expected entry (asserted,
// 4+ letter words) so hits come from meaning.
//
// Usage:  node diary-retrieve-probe.mjs [--cap 2] [--sweep 0.25,0.3,0.35,0.4,0.45,0.5]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const cap = Number(argVal("--cap", "2"));
const sweep = argVal("--sweep", "0.25,0.3,0.35,0.4,0.45,0.5").split(",").map(Number);

const { entries, actions } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../semantic-diary-cases.json"), "utf8"));

const semSrc = await readFile(path.join(REPO_ROOT, "src/lib/semanticDiary.ts"), "utf8");
const SHIPPED = Number(semSrc.match(/DIARY_SIM_THRESHOLD = ([\d.]+)/)[1]);
const relevanceSrc = await readFile(path.join(REPO_ROOT, "src/lib/memoryRelevance.ts"), "utf8");
const MODEL_ID = relevanceSrc.match(/EMBEDDING_MODEL_ID = '([^']+)'/)[1];

// Guard: no distinctive (4+ letter) word shared between a positive action and its expected entry.
const words = (s) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) || []);
for (const a of actions) {
  for (const id of a.expect) {
    const entry = entries.find((e) => e.id === id);
    const shared = [...words(a.text)].filter((w) => words(entry.text).has(w));
    if (shared.length) throw new Error(`case "${a.name}" shares [${shared}] with entry "${id}" — rewrite`);
  }
}

console.log(`Loading ${MODEL_ID} (q8)…`);
const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
const embed = async (texts) => {
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, r) => out.data.slice(r * d, (r + 1) * d));
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const entryVecs = await embed(entries.map((e) => e.text));
const actionVecs = await embed(actions.map((a) => a.text));

console.log(`\nPer-action similarities (■ = expected):`);
actions.forEach((a, ai) => {
  const sims = entries.map((e, ei) => ({ id: e.id, sim: cos(actionVecs[ai], entryVecs[ei]) }));
  sims.sort((x, y) => y.sim - x.sim);
  const top = sims.slice(0, 3).map((s) => `${a.expect.includes(s.id) ? "■" : " "}${s.id}:${s.sim.toFixed(2)}`).join("  ");
  console.log(`  ${a.name.padEnd(16)} ${top}`);
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
