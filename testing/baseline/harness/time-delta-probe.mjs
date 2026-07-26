// TIME-DELTA probe (Probe A of docs-internal/time-system-design.md) — can the model actually measure how
// much in-world time a turn consumed? This is the gate for phase 2's clock pass ('timePassed').
//
// Each case in ../time-delta-cases.json is a real-shaped (action, narration) pair with a ground-truth
// range in hours, chosen wide enough that any reasonable reading lands inside it. Cases cover the short
// end (an exchange, a scuffle), the middle (a walk, a meal, a night's sleep), and stated time in BOTH
// directions — a three-week skip that must be honored, and a stated ten minutes that must NOT be read as
// a long skip. That pair is the false-positive guard: a model that treats every stated interval as a
// timeskip passes `stated-skip` and fails `stated-short`.
//
// Baseline to beat is the flat hour the game charges today, scored against the same ranges — it is right
// only by luck, and the probe prints it so the comparison is explicit rather than assumed.
//
// The prompt comes from the REAL GamePrompts.ts at runtime, so editing the prompt is all that is needed
// between runs. Sampler matches the app's pin (timePassed: temperature 0).
//
//   node time-delta-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 12
//   node time-delta-probe.mjs --runs 3 [--only sleep] [--verbose]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import { parseArgs, callMessages, grab } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const VERBOSE = args.includes("--verbose");
const ONLY = argVal("--only", null);
const opts = parseArgs(process.argv, { runs: "3" });

// The real parser, so the probe scores exactly what the app would store — clamp, fallback and all.
const clockTs = await readFile(path.join(REPO_ROOT, "src/lib/gameClock.ts"), "utf8");
const { code } = await transform(clockTs, { loader: "ts", format: "esm" });
const clock = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

const SYS = grab("defaultTimePassedPrompt");
const USER = grab("defaultTimePassedUserPrompt");
const cases = JSON.parse(await readFile(path.join(HARNESS_DIR, "../time-delta-cases.json"), "utf8"))
  .filter((c) => !ONLY || c.id === ONLY);

const fmt = (h) => (h >= 24 ? `${(h / 24).toFixed(1)}d` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`);
const inRange = (h, c) => h !== null && h >= c.min && h <= c.max;

console.log(`${cases.length} cases · model ${opts.model} · runs ${opts.runs} · temp 0 (the app's timePassed pin)\n`);
await callMessages({ ...opts, temp: 0, maxTokens: 4 }, [{ role: "user", content: "ping" }]).catch(() => {});

let hit = 0, total = 0, unparseable = 0, flatHit = 0;
for (const c of cases) {
  const got = [];
  for (let r = 0; r < opts.runs; r++) {
    const reply = await callMessages({ ...opts, temp: 0, maxTokens: 12 }, [
      { role: "system", content: SYS },
      { role: "user", content: USER.replace("<PLAYER ACTION>", c.action).replace("<NARRATION>", c.narration) },
    ]);
    const hours = clock.parseTimeDelta(reply);
    got.push({ reply: reply.replace(/\s+/g, " ").slice(0, 24), hours });
    total++;
    if (hours === null) unparseable++;
    if (inRange(hours, c)) hit++;
    if (VERBOSE) console.log(`    ${c.id}#${r + 1} "${got[got.length - 1].reply}" -> ${hours === null ? "unparseable" : fmt(hours)}`);
  }
  // The flat hour scored against the same range, once per run, so the comparison is like-for-like.
  if (inRange(clock.FLAT_HOURS_PER_TURN, c)) flatHit += opts.runs;
  const ok = got.filter((g) => inRange(g.hours, c)).length;
  const shown = got.map((g) => (g.hours === null ? "??" : fmt(g.hours))).join(" ");
  console.log(`${ok === opts.runs ? "OK  " : ok === 0 ? "MISS" : "part"} ${c.id.padEnd(13)} want ${fmt(c.min)}..${fmt(c.max)}  got ${shown}`);
}

const pct = (n) => `${Math.round((n / Math.max(1, total)) * 100)}%`;
console.log(`\nmeasured  in range ${pct(hit)} (${hit}/${total}) · unparseable ${pct(unparseable)}`);
console.log(`flat 1h   in range ${pct(flatHit)} (${flatHit}/${total})  <- the baseline it has to beat`);
