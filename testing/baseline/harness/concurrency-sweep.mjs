// Concurrency sweep — finds a model's useful-concurrency knee on a given endpoint. For each concurrency
// level c, it fires c identical-length requests AT ONCE, waits for all, and measures aggregate throughput
// (summed completion tokens ÷ wall-clock). Throughput rises with c, then plateaus once the GPU is
// compute-bound (more in-flight just time-slices) or drops if VRAM/KV-cache thrashes. The plateau is the max
// useful concurrency — cap the app's turn batch around it.
//
// This measures the server AS CONFIGURED. Set LM Studio's "Parallel" to the highest value you'd consider
// before sweeping (levels above it just queue, which shows as a flat/declining throughput tail).
//
// Usage:  node concurrency-sweep.mjs [--endpoint URL] [--model NAME] [--levels 1,2,4,8,12,16]
//                                    [--rounds 3] [--max 200] [--token TOK]

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "http://127.0.0.1:1234/v1/chat/completions");
const model = argVal("--model", "silver-siren-12b");
const levels = argVal("--levels", "1,2,4,8,12,16").split(",").map((n) => parseInt(n.trim())).filter((n) => n > 0);
const rounds = Number(argVal("--rounds", "3"));
const maxTokens = Number(argVal("--max", "200"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");

// A prompt that reliably fills the token budget with real decode work. Varied per request (the scene index)
// so identical-prompt caching can't shortcut the generation and inflate throughput.
const promptFor = (i) =>
  `Write one vivid paragraph of second-person interactive-fiction narration for scene #${i}: a traveler arrives at a fog-bound river landing at dusk. Keep going until you are cut off; do not summarize or stop early.`;

async function call(i) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: promptFor(i) }],
      max_tokens: maxTokens, temperature: 0.7, reasoning_effort: "none", stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  const tokens = j.usage?.completion_tokens ?? null;
  return { tokens, text: j.choices?.[0]?.message?.content ?? "" };
}

// Fire `c` requests at once, wait for all, return aggregate wall-clock + token total (+ any failures).
async function fireBatch(c, seed) {
  const t0 = performance.now();
  const results = await Promise.allSettled(Array.from({ length: c }, (_, k) => call(seed + k)));
  const wall = performance.now() - t0;
  let tokens = 0, ok = 0, failed = 0, missingUsage = false;
  for (const r of results) {
    if (r.status !== "fulfilled") { failed++; continue; }
    ok++;
    if (r.value.tokens == null) { missingUsage = true; tokens += (r.value.text.match(/\S+/g) || []).length; }
    else tokens += r.value.tokens;
  }
  return { wall, tokens, ok, failed, missingUsage };
}

const ms = (n) => `${Math.round(n)}ms`;
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`Concurrency sweep · ${endpoint} · "${model}"`);
console.log(`Levels ${levels.join(", ")} · ${rounds} round(s)/level · ${maxTokens} max_tokens\n`);

// Warm the model so level-1 isn't paying load cost.
process.stdout.write("warming up... ");
let anyMissingUsage = false;
try { const w = await call(0); if (w.tokens == null) anyMissingUsage = true; console.log("done\n"); }
catch (e) { console.log(`\nWARMUP FAILED: ${e.message}`); process.exit(1); }

let seed = 1000;
const rows = [];
for (const c of levels) {
  const walls = [], tps = [];
  let ok = 0, failed = 0;
  for (let r = 0; r < rounds; r++) {
    const b = await fireBatch(c, seed);
    seed += c;
    walls.push(b.wall);
    tps.push(b.tokens / (b.wall / 1000));
    ok += b.ok; failed += b.failed;
    if (b.missingUsage) anyMissingUsage = true;
  }
  const row = { c, wall: avg(walls), tps: avg(tps), ok, failed };
  rows.push(row);
  console.log(`c=${String(c).padStart(2)}  wall ${ms(row.wall).padStart(7)}  tok/s ${row.tps.toFixed(0).padStart(5)}${failed ? `  FAILED ${failed}` : ""}`);
}

const base = rows[0].tps;
let peak = rows[0];
for (const r of rows) if (r.tps > peak.tps) peak = r;
console.log(`\n==== throughput vs concurrency ====`);
console.log(`concurrency   tok/s    speedup vs c=1`);
for (const r of rows) {
  const mark = r === peak ? "  ← peak" : r.tps < peak.tps * 0.95 && r.c > peak.c ? "  (past knee)" : "";
  console.log(`  c=${String(r.c).padEnd(3)}       ${r.tps.toFixed(0).padStart(5)}    ${(r.tps / base).toFixed(2)}x${mark}`);
}
console.log(`\nKnee ≈ c=${peak.c} (peak aggregate throughput ${peak.tps.toFixed(0)} tok/s). Firing more than that mostly adds latency, not throughput.`);
if (rows.some((r) => r.failed)) console.log(`⚠ Some requests FAILED — you likely exceeded the KV-cache/VRAM ceiling below the throughput knee. Lower LM Studio's Parallel or context length.`);
if (anyMissingUsage) console.log(`⚠ Endpoint didn't return usage.completion_tokens; token counts are word-count approximations.`);
