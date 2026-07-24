// Recall-margin probe — tunes/validates REHYDRATE_MARGIN (src/lib/semanticRehydration.ts) against
// ../semantic-recall-margin-cases.json: a same-cast one-house fixture where every digest clears the
// absolute floor, so only the margin-over-median rule separates a real return-to-scene from baseline
// charged noise. Deterministic (embeddings only, no LLM). Fire rule mirrors the lib: top-K by cosine,
// sim >= max(floor, median + margin); the near-duplicate guard is omitted (it only prunes second
// picks and cannot change whether a case fires at all). Margin 0 = the pre-T2 floor-only baseline.
// Per margin: return HIT (an expected digest fired) and charged CLEAN (nothing fired) rates.
//
// Query arms (T3): "bare" = the action alone (shipped pre-T3); "enriched" = action + the case's
// narrationTail (~2 sentences of latest narration). The T3 bar: enriched must keep return hits and
// must not lose charged-clean (recency bias pulling the current scene's near-duplicates back in).
//
// Usage:  node recall-margin-probe.mjs [--sweep 0,0.05,0.1,0.15,0.2] [--cap 2] [--arms bare,enriched]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const sweep = argVal("--sweep", "0,0.05,0.1,0.15,0.2").split(",").map(Number);

const fx = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../semantic-recall-margin-cases.json"), "utf8"));

const rehydrateSrc = await readFile(path.join(REPO_ROOT, "src/lib/semanticRehydration.ts"), "utf8");
const FLOOR = Number(rehydrateSrc.match(/REHYDRATE_SIM_THRESHOLD = ([\d.]+)/)[1]);
const SHIPPED_MARGIN = Number(rehydrateSrc.match(/REHYDRATE_MARGIN = ([\d.]+)/)[1]);
const CAP = Number(argVal("--cap", rehydrateSrc.match(/REHYDRATE_MAX = (\d+)/)[1]));
const relevanceSrc = await readFile(path.join(REPO_ROOT, "src/lib/memoryRelevance.ts"), "utf8");
const MODEL_ID = relevanceSrc.match(/EMBEDDING_MODEL_ID = '([^']+)'/)[1];

console.log(`Loading ${MODEL_ID} (q8)…`);
const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
const embed = async (texts) => {
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, r) => out.data.slice(r * d, (r + 1) * d));
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const arms = argVal("--arms", "bare,enriched").split(",");
const digestVecs = await embed(fx.digests);
const queryVecsByArm = {
  bare: await embed(fx.actions.map((a) => a.text)),
  enriched: await embed(fx.actions.map((a) => `${a.text}\n${a.narrationTail}`)),
};

console.log(`\nFloor ${FLOOR} · cap ${CAP} · band size ${fx.digests.length}`);
for (const arm of arms) {
  const queryVecs = queryVecsByArm[arm];

  // Per-action similarity table: median, the margin bar it implies, and the top-3 (■ = expected).
  console.log(`\n[${arm}] per-action similarities (■ = expected):`);
  for (let ai = 0; ai < fx.actions.length; ai++) {
    const a = fx.actions[ai];
    const sims = digestVecs.map((v, di) => ({ di, sim: cos(queryVecs[ai], v) }));
    const sorted = [...sims].sort((x, y) => x.sim - y.sim).map((s) => s.sim);
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const top = [...sims].sort((x, y) => y.sim - x.sim).slice(0, 3)
      .map((s) => `${a.expect.includes(s.di) ? "■" : " "}d${s.di}:${s.sim.toFixed(2)}`).join(" ");
    console.log(`  ${a.name.padEnd(18)} med ${median.toFixed(2)}  ${top}`);
  }

  console.log(`\n[${arm}] margin sweep (fire = sim >= max(${FLOOR}, median + margin), top ${CAP}):`);
  console.log(`  margin  return-hits  charged-clean  fired`);
  for (const margin of sweep) {
    let hits = 0, returns = 0, clean = 0, charged = 0, fired = 0;
    for (let ai = 0; ai < fx.actions.length; ai++) {
      const a = fx.actions[ai];
      const sims = digestVecs.map((v, di) => ({ di, sim: cos(queryVecs[ai], v) }));
      const sorted = [...sims].sort((x, y) => x.sim - y.sim).map((s) => s.sim);
      const median = sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      const bar = Math.max(FLOOR, median + margin);
      const firing = sims.filter((s) => s.sim >= bar).sort((x, y) => y.sim - x.sim).slice(0, CAP);
      fired += firing.length;
      if (a.expect.length) {
        returns++;
        if (firing.some((s) => a.expect.includes(s.di))) hits++;
      } else {
        charged++;
        if (firing.length === 0) clean++;
      }
    }
    const mark = margin === SHIPPED_MARGIN ? "  ← shipped" : margin === 0 ? "  (floor-only baseline)" : "";
    console.log(`  ${margin.toFixed(2)}    ${hits}/${returns}          ${clean}/${charged}            ${String(fired).padStart(2)}${mark}`);
  }
}
