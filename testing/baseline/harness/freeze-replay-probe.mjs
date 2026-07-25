// Charged-scene freeze replay (roadmap step 2's open gate): replays the REAL failed session's
// scene-recall selection turn by turn from its AI-context dump — real digests, real actions,
// deterministic embeddings (no LLM). Two arms:
//   old — the stack that shipped dark and produced the observed pathology: absolute floor 0.35 +
//         near-duplicate guard, no margin, no cooldown (27/34 turns fired; the living-room scene
//         rode 10x; 9/27 firings identical to the previous turn's).
//   new — the shipped post-tuning stack: + margin-over-median 0.15 (min band 5) + cooldown 3.
// The old arm doubles as replay validation: it must reproduce the reported pathology before the
// new arm's delta means anything. Selection logic mirrors src/lib/semanticRehydration.ts by hand
// (keep in sync); band = all digested turns older than the 4-turn floor (milestone drops ignored —
// the session's full-vote verdicts flip-flopped and T32 kept everything anyway).
//
// Usage:  node freeze-replay-probe.mjs --dump "D:\Downloads\repeat.json" [--arms old,new]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DUMP = argVal("--dump", "D:\\Downloads\\repeat.json");
const arms = argVal("--arms", "old,new").split(",");

// Shipped constants, read live from the lib so the probe can't drift silently.
const libSrc = await readFile(path.join(REPO_ROOT, "src/lib/semanticRehydration.ts"), "utf8");
const FLOOR_SIM = Number(libSrc.match(/REHYDRATE_SIM_THRESHOLD = ([\d.]+)/)[1]);
const DUP = Number(libSrc.match(/REHYDRATE_DUP_THRESHOLD = ([\d.]+)/)[1]);
const MAX = Number(libSrc.match(/REHYDRATE_MAX = (\d+)/)[1]);
const MARGIN = Number(libSrc.match(/REHYDRATE_MARGIN = ([\d.]+)/)[1]);
const MIN_BAND = Number(libSrc.match(/REHYDRATE_MARGIN_MIN_BAND = (\d+)/)[1]);
const COOLDOWN = Number(libSrc.match(/REHYDRATE_COOLDOWN_TURNS = (\d+)/)[1]);
const VERBATIM_FLOOR = 4;

const dump = JSON.parse(await readFile(DUMP, "utf8"));
const turns = dump.map((e) => ({
  action: e.action,
  digest: (e.requests.find((r) => r.type === "summary")?.response ?? "").trim(),
})).filter((t) => t.digest);
console.log(`${turns.length} digested turns · floor ${FLOOR_SIM} dup ${DUP} max ${MAX} margin ${MARGIN} minBand ${MIN_BAND} cooldown ${COOLDOWN}`);

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

const digestVecs = await embed(turns.map((t) => t.digest));
const actionVecs = await embed(turns.map((t) => t.action));

function replay(arm) {
  const lastFired = new Map(); // scene idx -> turn fired
  const perTurn = [];
  for (let t = 0; t < turns.length; t++) {
    const bandIdx = [];
    for (let i = 0; i < Math.max(0, t - VERBATIM_FLOOR); i++) bandIdx.push(i);
    const floorIdx = [];
    for (let i = Math.max(0, t - VERBATIM_FLOOR); i < t; i++) floorIdx.push(i);
    if (!bandIdx.length) { perTurn.push([]); continue; }

    const sims = bandIdx.map((i) => ({ i, sim: cos(actionVecs[t], digestVecs[i]) }));
    const sorted = sims.map((s) => s.sim).sort((a, b) => a - b);
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const bar = arm === "new" && sims.length >= MIN_BAND ? Math.max(FLOOR_SIM, median + MARGIN) : FLOOR_SIM;
    const blocked = new Set();
    if (arm === "new") {
      for (const [i, fired] of lastFired) {
        const gap = t - fired;
        if (gap > 0 && gap < COOLDOWN) blocked.add(i);
      }
    }
    const scored = sims.filter((s) => !blocked.has(s.i)).filter((s) => s.sim >= bar).sort((a, b) => b.sim - a.sim);
    const chosen = [];
    for (const c of scored) {
      if (chosen.length >= MAX) break;
      const dup = [...chosen.map((x) => digestVecs[x]), ...floorIdx.map((i) => digestVecs[i])]
        .some((v) => cos(digestVecs[c.i], v) >= DUP);
      if (!dup) chosen.push(c.i);
    }
    for (const i of chosen) lastFired.set(i, t);
    perTurn.push(chosen);
  }
  return perTurn;
}

for (const arm of arms) {
  const perTurn = replay(arm);
  const fireCounts = new Map();
  let firingTurns = 0, sticky = 0, totalFires = 0;
  perTurn.forEach((chosen, t) => {
    if (chosen.length) firingTurns++;
    totalFires += chosen.length;
    for (const i of chosen) {
      fireCounts.set(i, (fireCounts.get(i) || 0) + 1);
      if (t > 0 && perTurn[t - 1].includes(i)) sticky++;
    }
  });
  const top = [...fireCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(`\n[${arm}] turns firing ${firingTurns}/${perTurn.length} · total fires ${totalFires} · consecutive-repeat fires ${sticky}`);
  for (const [i, n] of top) console.log(`  ${n}× scene T${i}: ${turns[i].digest.slice(0, 90)}`);
  console.log(`  per-turn: ${perTurn.map((c) => (c.length ? c.map((i) => `T${i}`).join("+") : "·")).join(" ")}`);
}
