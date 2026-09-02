// TIME-STAMP probe (Probe B + C of docs-internal/designs/time-system/design.md) — does stamping each digest with
// when it happened give the model usable time, and does it cost anything in the narration?
//
// Two arms over a REAL session dump's digests:
//   A  shipped  — the recap reply exactly as the band builds it today (digests joined, undated)
//   B  stamped  — the same digests, each prefixed `[Day 3, evening — two days ago]`
// The stamps come from the REAL src/lib/gameClock.ts (transpiled at runtime via esbuild), so editing that
// module is all that's needed between runs — the probe never re-implements the formatting.
//
// Three measurements:
//   1. RECALL   — for K sampled memories, "how many days ago did this happen?" against ground truth from
//                 the clock. Also a whole-story span question. Objective %.
//   2. ORDER    — for K pairs, "which happened first?". The recap is already chronological in BOTH arms,
//                 so this is the guard that stamps don't CONFUSE ordering that plain order already gave.
//   3. PROSE    — a real turn's narration regenerated under each arm: word count, quoted dialogue rate,
//                 and calendar-leak rate (does "Day 3" / a daypart word escape into the story text?).
//                 This is the actual gate — recall can only improve, prose is what can regress.
//
// The clock is sampled two ways, because phase 1 ships a flat hour per turn and phase 2 measures it:
//   --clock flat      one hour per turn (what ships today; a 45-turn session spans under two days)
//   --clock measured  a fixed plausible per-turn hour vector (what phase 2's timePassed pass produces)
//
//   node time-stamp-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 12
//   node time-stamp-probe.mjs --runs 3 --clock measured

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import { parseArgs, callMessages } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DUMP = argVal("--dump", path.join(HARNESS_DIR, "../runs/close-session.json"));
const CLOCK = argVal("--clock", "flat");
const SAMPLES = Number(argVal("--samples", "6"));
const PROSE_TURN = Number(argVal("--prose-turn", "35"));
const ONLY = argVal("--arm", null);
const SHOW_PROSE = args.includes("--show-prose"); // print every narration, to eyeball what a leak looks like
const opts = parseArgs(process.argv, { runs: "3" });

// The real clock module, transpiled in memory. No hand-mirroring: a formatting change lands here for free.
const clockTs = await readFile(path.join(REPO_ROOT, "src/lib/gameClock.ts"), "utf8");
const { code } = await transform(clockTs, { loader: "ts", format: "esm" });
const clock = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

const dump = JSON.parse(await readFile(DUMP, "utf8"));
const digests = dump
  .map((t, i) => ({ turn: i + 1, text: (t.requests?.find((r) => r.type === "summary")?.response || "").trim() }))
  .filter((d) => d.text);
if (digests.length < 12) throw new Error(`dump has only ${digests.length} digests; need a longer session`);

// Elapsed story hours at each turn. `flat` is today's clock; `measured` is a plausible spread — mostly
// scene-length minutes with a few rests and one journey, i.e. what a working timePassed pass returns.
// Fixed, not random, so runs stay comparable.
const MEASURED_CYCLE = [0.25, 0.5, 0.25, 1, 0.5, 2, 0.25, 8, 0.5, 0.25, 1, 0.5, 4, 0.25, 12, 0.5];
function hoursByTurn(kind) {
  const out = new Map();
  let acc = 0;
  for (let i = 0; i < digests.length; i++) {
    acc += kind === "measured" ? MEASURED_CYCLE[i % MEASURED_CYCLE.length] : 1;
    out.set(digests[i].turn, acc);
  }
  return out;
}
const HOURS = hoursByTurn(CLOCK);
const NOW = HOURS.get(digests[digests.length - 1].turn);

// The band as it actually rides: every digest but the verbatim floor, merged into one recap reply.
const VERBATIM_FLOOR = 2;
const band = digests.slice(0, digests.length - VERBATIM_FLOOR);
const stampOf = (d) => clock.formatStamp(HOURS.get(d.turn), NOW);
const bandText = (stamped) => band.map((d) => (stamped ? `${stampOf(d)} ${d.text}` : d.text)).join(" ");
const RECAP_Q = "Recap the story so far.";
const nowLine = (stamped) => (stamped ? ` ${clock.formatNow(NOW)}` : "");

const dayOf = (h) => clock.dayAndHour(h).day;
const trueDaysAgo = (d) => dayOf(NOW) - dayOf(HOURS.get(d.turn));

// Evenly spaced samples across the band, so the set spans old and recent alike.
const step = Math.max(1, Math.floor(band.length / SAMPLES));
const sampled = Array.from({ length: SAMPLES }, (_, i) => band[i * step]).filter(Boolean);

function recapMessages(stamped) {
  return [
    { role: "user", content: RECAP_Q },
    { role: "assistant", content: bandText(stamped) + nowLine(stamped) },
  ];
}

const QUIZ_SYS =
  "You answer questions about the story you have been told, using only what is in it. Answer with a number alone and nothing else.";

async function askDaysAgo(stamped, d) {
  // The cue is the digest WITHOUT its stamp, so arm B must find it in context rather than be handed it.
  const out = await callMessages({ ...opts, temp: 0, maxTokens: 12 }, [
    { role: "system", content: QUIZ_SYS },
    ...recapMessages(stamped),
    { role: "user", content: `How many days ago did this happen? "${d.text.slice(0, 180)}"\nAnswer with a whole number of days.` },
  ]);
  const m = out.match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

async function askSpan(stamped) {
  const out = await callMessages({ ...opts, temp: 0, maxTokens: 12 }, [
    { role: "system", content: QUIZ_SYS },
    ...recapMessages(stamped),
    { role: "user", content: "How many days have passed since the story began?\nAnswer with a whole number of days." },
  ]);
  const m = out.match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

async function askOrder(stamped, a, b) {
  const out = await callMessages({ ...opts, temp: 0, maxTokens: 12 }, [
    { role: "system", content: "You answer questions about the story you have been told. Reply with only the letter A or B." },
    ...recapMessages(stamped),
    { role: "user", content: `Which happened FIRST?\nA. "${a.text.slice(0, 140)}"\nB. "${b.text.slice(0, 140)}"\nReply A or B.` },
  ]);
  return /\bA\b/i.test(out) ? "A" : /\bB\b/i.test(out) ? "B" : null;
}

// Prose arm: a real narration request with only the recap reply swapped between arms.
const proseBase = dump[PROSE_TURN - 1]?.requests?.find((r) => r.type === "narration")?.messages;
const proseOk = Array.isArray(proseBase) && proseBase[1]?.content === RECAP_Q;
async function askProse(stamped) {
  const messages = proseBase.map((m, i) =>
    i === 2 ? { ...m, content: bandText(stamped) + nowLine(stamped) } : m,
  );
  // Narration is unpinned in promptSamplers — send no temperature override beyond the harness default.
  return callMessages({ ...opts, temp: 0.7, maxTokens: 600 }, messages);
}

const DAYPARTS = /\b(dawn|midday|afternoon|evening|nightfall)\b|\bDay \d+\b/gi;
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");

console.log(`dump ${path.basename(DUMP)} · ${digests.length} digests · clock=${CLOCK} · now=${clock.formatAbsolute(NOW)} (${NOW}h) · model ${opts.model} · runs ${opts.runs}`);
console.log(`sampled turns: ${sampled.map((d) => `${d.turn}(${trueDaysAgo(d)}d)`).join(" ")}\n`);

await callMessages({ ...opts, temp: 0, maxTokens: 4 }, [{ role: "user", content: "ping" }]).catch(() => {});

for (const [arm, stamped] of [["A shipped", false], ["B stamped", true]]) {
  if (ONLY && !arm.startsWith(ONLY)) continue;
  let recallHit = 0, recallTot = 0, recallErr = 0, spanHit = 0, spanTot = 0;
  let orderHit = 0, orderTot = 0;
  let words = 0, proseRuns = 0, dialogue = 0, leaks = 0;

  for (let r = 0; r < opts.runs; r++) {
    for (const d of sampled) {
      const got = await askDaysAgo(stamped, d);
      recallTot++;
      if (got !== null) {
        const truth = trueDaysAgo(d);
        recallErr += Math.abs(got - truth);
        if (got === truth) recallHit++;
      }
    }
    const span = await askSpan(stamped);
    spanTot++;
    if (span !== null && Math.abs(span - (dayOf(NOW) - 1)) <= 1) spanHit++;

    for (let i = 0; i + 1 < sampled.length; i++) {
      const got = await askOrder(stamped, sampled[i], sampled[i + 1]);
      orderTot++;
      if (got === "A") orderHit++; // sampled is chronological, so A is always the earlier one
    }

    if (proseOk) {
      const out = await askProse(stamped);
      proseRuns++;
      words += out.split(/\s+/).filter(Boolean).length;
      if (/["“”]/.test(out)) dialogue++;
      const hits = out.match(DAYPARTS) || [];
      if (hits.length) leaks++;
      if (SHOW_PROSE) console.log(`--- ${arm}#${r + 1}${hits.length ? ` LEAK[${hits.join(",")}]` : ""}\n${out}\n`);
    }
  }

  console.log(`${arm}`);
  console.log(`  RECALL  exact ${pct(recallHit, recallTot)} (${recallHit}/${recallTot}) · mean error ${(recallErr / Math.max(1, recallTot)).toFixed(2)} days`);
  console.log(`  SPAN    within 1 day ${pct(spanHit, spanTot)} (${spanHit}/${spanTot})`);
  console.log(`  ORDER   correct ${pct(orderHit, orderTot)} (${orderHit}/${orderTot})`);
  if (proseOk) {
    console.log(`  PROSE   ${Math.round(words / Math.max(1, proseRuns))}w avg · dialogue ${pct(dialogue, proseRuns)} · calendar leak ${pct(leaks, proseRuns)}`);
  } else {
    console.log(`  PROSE   skipped (turn ${PROSE_TURN} has no recap-bearing narration request)`);
  }
  console.log("");
}
