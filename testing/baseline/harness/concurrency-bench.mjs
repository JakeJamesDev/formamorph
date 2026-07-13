// Concurrency benchmark — measures the post-narration aux batch (choices + stat updates + location router)
// run SEQUENTIALLY vs CONCURRENTLY against a live endpoint, averaged over N rounds. Answers: does firing the
// three requests at once (Promise.all) actually cut wall-clock on this server, or does contention eat the win?
//
// Fairness: each round runs BOTH modes back-to-back and ALTERNATES which goes first, so warmup/thermal drift
// cancels out. A warmup call primes the model before timing starts. Per-request latencies are printed so you
// can see whether concurrency inflates individual requests (batching contention) even when the total drops.
//
// Usage:  node concurrency-bench.mjs [--endpoint URL] [--model NAME] [--rounds 8] [--token TOK]
//   Defaults to the Ollama testing endpoint + silver-siren-12b from profiles.json conventions.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "http://127.0.0.1:11434/v1/chat/completions");
const model = argVal("--model", "silver-siren-12b");
const rounds = Number(argVal("--rounds", "8"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");

// A representative post-narration turn: one prose passage + entity, mirroring what the app feeds each request.
const NARRATION =
  "Corvin rises from the table without hurry, smoothing the front of his coat with one pale hand. The pleasant mask has not slipped, but his eyes have gone flat and cold. \"You're a hard woman to do business with,\" he says, and his hand does not stop at the buttons - it drifts on, toward the dark line of a sheath half-hidden beneath the wool. Behind him, the tavern has gone quiet.";
const ACTION = "I keep my hands where he can see them and ask him, evenly, what it will take to settle the debt.";

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};

// Fill every placeholder generically — the exact content doesn't matter for timing, only realistic token
// counts. Any leftover <...> tokens are stripped so the model isn't confused by stray placeholders.
const fill = (tpl) =>
  tpl
    .replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<PLAYER ACTION>", ACTION)
    .replaceAll("<NARRATION>", NARRATION)
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady\n- **Guile:** sharp")
    .replaceAll("<STATS DESCRIPTION>", "Resolve: steady. Guile: sharp.")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<TRAITS DESCRIPTION>", playerTrait)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|summary.markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION>", location)
    .replaceAll("<ENTITIES|summary.markdown>", "- **Corvin** - A soft-voiced debt collector. (Person)")
    .replaceAll("<ENTITIES>", "Corvin - A soft-voiced debt collector.")
    .replaceAll(/<[^>]+>/g, "N/A");

// The full post-narration batch as it fires in concurrent mode with everything on (Staged + digests +
// diaries): choices + stats + location + memory summary + N character diaries + 1 discover. Each carries its
// real system + user prompt and the app's token caps. Diary/discover user messages mirror buildDiaryUserMessage
// / the discover payload shape closely enough for realistic token counts.
const diaryUser = (name) =>
  `You are ${name}.\nWho you are: A soft-voiced debt collector with hard eyes and a hidden knife.\n\nAccount of what just happened (in it, "you" means the player character, not you - you appear as ${name}):\n${NARRATION}\n\nAs ${name}, write my own diary entry now - one or two sentences, first person ("I" = ${name}).`;
const discoverUser = (name) => `Character name: ${name}\n\nThe passage they appeared in:\n${NARRATION}`;
const REQUESTS = [
  { type: "choices", sys: fill(grab("defaultChoicesPrompt")), user: fill(grab("defaultChoicesUserPrompt")), max: 320 },
  { type: "stats", sys: fill(grab("defaultStatUpdatesPrompt")), user: fill(grab("defaultStatUpdatesUserPrompt")), max: 320 },
  { type: "location", sys: fill(grab("defaultLocationChangePrompt")), user: fill(grab("defaultLocationChangeUserPrompt")), max: 64 },
  { type: "summary", sys: fill(grab("defaultSummaryPrompt")), user: fill(grab("defaultSummaryUserPrompt")), max: 200 },
  { type: "diary:Corvin", sys: fill(grab("defaultDiaryPrompt")), user: diaryUser("Corvin"), max: 80 },
  { type: "diary:Odette", sys: fill(grab("defaultDiaryPrompt")), user: diaryUser("Odette"), max: 80 },
  { type: "discover", sys: grab("defaultDiscoverEntityPrompt"), user: discoverUser("Odette"), max: 200 },
];

async function call(req) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = performance.now();
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: req.sys }, { role: "user", content: req.user }],
      max_tokens: req.max, reasoning_effort: "none", stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  await res.json();
  return performance.now() - t0;
}

async function sequential() {
  const t0 = performance.now();
  const per = {};
  for (const req of REQUESTS) per[req.type] = await call(req);
  return { total: performance.now() - t0, per };
}

async function concurrent() {
  const t0 = performance.now();
  const per = {};
  await Promise.all(REQUESTS.map(async (req) => { per[req.type] = await call(req); }));
  return { total: performance.now() - t0, per };
}

const ms = (n) => `${Math.round(n)}ms`;
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const TYPES = REQUESTS.map((r) => r.type);
console.log(`Concurrency bench · ${endpoint} · "${model}" · ${rounds} round(s)`);
console.log(`Batch (${REQUESTS.length}): ${REQUESTS.map((r) => `${r.type}(${r.max})`).join(" + ")}, post-narration\n`);

// Warm the model so the first timed round isn't paying load cost.
process.stdout.write("warming up... ");
try { await call(REQUESTS[0]); console.log("done\n"); } catch (e) { console.log(`\nWARMUP FAILED: ${e.message}`); process.exit(1); }

const seqTotals = [], conTotals = [];
const seqPer = Object.fromEntries(TYPES.map((t) => [t, []]));
const conPer = Object.fromEntries(TYPES.map((t) => [t, []]));

for (let r = 0; r < rounds; r++) {
  // Alternate order each round so neither mode always benefits from a warmer cache.
  const seqFirst = r % 2 === 0;
  let s, c;
  if (seqFirst) { s = await sequential(); c = await concurrent(); }
  else { c = await concurrent(); s = await sequential(); }
  seqTotals.push(s.total); conTotals.push(c.total);
  for (const k of TYPES) { seqPer[k].push(s.per[k]); conPer[k].push(c.per[k]); }
  console.log(`round ${r + 1}: seq ${ms(s.total)}  |  con ${ms(c.total)}  |  delta ${ms(s.total - c.total)} (${Math.round((1 - c.total / s.total) * 100)}%)`);
}

const seqAvg = avg(seqTotals), conAvg = avg(conTotals);
console.log(`\n==== averages over ${rounds} rounds ====`);
console.log(`sequential total : ${ms(seqAvg)}`);
console.log(`concurrent total : ${ms(conAvg)}`);
console.log(`speedup          : ${ms(seqAvg - conAvg)} faster  (${Math.round((1 - conAvg / seqAvg) * 100)}% reduction)`);
console.log(`\nper-request avg latency (seq → con, shows contention):`);
for (const k of TYPES) {
  console.log(`  ${k.padEnd(14)} ${ms(avg(seqPer[k]))} → ${ms(avg(conPer[k]))}`);
}
