// PARALLELISM BENCHMARK — find how many concurrent LM Studio requests actually raise throughput before the
// GPU saturates and they just queue. Fires N independent requests at once (varied seed → no shared cache),
// each generating a fixed token count, and reports AGGREGATE completion-tokens/sec per concurrency level.
// The level where agg tok/s stops rising (or falls) is the useful ceiling; set the probe pool one below it.
//
//   node bench-parallel.mjs [--levels 1,2,4,8,12,16] [--gen 256] [--model ...] [--reps 2]

import { parseArgs } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const strArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const opts = parseArgs(process.argv);
const LEVELS = strArg("--levels", "1,2,4,8,12,16").split(",").map(Number);
const GEN = Number(strArg("--gen", "256"));
const REPS = Number(strArg("--reps", "2"));

// A representative narration-sized prompt so timing reflects real use, not a toy.
const SYS = "You are the narrator of an interactive story. Write vivid second-person present-tense prose.";
const USER = "Continue the scene: you step into the crowded party and Sarah waves you over from across the room. Write two paragraphs.";
// Local fetch (not callMessages) so we can read usage.completion_tokens for exact throughput.
async function one(seed) {
  const headers = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(opts.endpoint, {
    method: "POST", headers,
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: "system", content: SYS }, { role: "user", content: USER }],
      max_tokens: GEN, temperature: 0.7, seed, reasoning_effort: "none", stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return j.usage?.completion_tokens ?? 0;
}

console.log(`PARALLELISM BENCH · "${opts.model}" · gen ${GEN} tok · reps ${REPS}`);
console.log(`levels: ${LEVELS.join(", ")}\n`);
console.log("conc | wall(s) | agg tok | agg tok/s | per-req tok/s | speedup");

let base = null;
await one(1); // warmup
for (const C of LEVELS) {
  let bestAgg = 0, bestWall = Infinity, bestTok = 0;
  for (let rep = 0; rep < REPS; rep++) {
    const t0 = Date.now();
    const outs = await Promise.all(Array.from({ length: C }, (_, i) => one(1000 + C * 100 + rep * 10 + i)));
    const wall = (Date.now() - t0) / 1000;
    const tok = outs.reduce((a, o) => a + o, 0);
    const agg = tok / wall;
    if (agg > bestAgg) { bestAgg = agg; bestWall = wall; bestTok = tok; }
  }
  if (base === null) base = bestAgg;
  const perReq = bestAgg / C;
  console.log(`${String(C).padStart(4)} | ${bestWall.toFixed(1).padStart(6)} | ${String(bestTok).padStart(6)} | ${bestAgg.toFixed(1).padStart(8)} | ${perReq.toFixed(1).padStart(12)} | ${(bestAgg / base).toFixed(2)}x`);
}
console.log(`\nRead: agg tok/s rising = parallelism helping. Plateau/drop = saturated. Per-req tok/s falling is expected;`);
console.log(`the ceiling is the highest conc where AGG tok/s is still climbing. Set the probe pool at or just below it.`);
