// NON-PLAN NARRATION eval — the gate before shipping a summary-prompt change. In non-plan mode the narrator
// gets the banded message history directly (older assistant turns ARE the digests) with no planner in front,
// so the digests' voice is load-bearing for the prose. This probe re-fires each turn's real narration request
// in NON-PLAN form and scores the resulting prose, to check a factual-digest history doesn't degrade narration.
//
// It reconstructs non-plan from the recorded (plan-mode) export by:
//   1. stripping the plan from the final user turn (everything from "Rough notes on what happens this turn"),
//   2. optionally swapping the A digests in the assistant history for B digests (--swap <redigested.json>),
// then fires narration (fixed temp+seed for reproducible A/B) and scores freeze / dialogue / deferral / length.
//
//   A (story-voice digests):  node narration-replay-probe.mjs <export> --replay --runs 3 --from 16 --to 49
//   B (factual digests):      ... --swap <redigested-Bfull.json>
//
// The A/B question: does B's cleaner history keep dialogue and prose quality (freeze↓/dialogue≈/defer≈ = safe).

import { readFile } from "node:fs/promises";
import { parseArgs, FREEZE_RE, DEFER_RE, QUOTE_RE, callMessages, printOut } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--")) || null;
if (!file) { console.error("Provide an ai-context export path as the first argument."); process.exit(1); }
const flag = (f) => argv.includes(f);
const strArg = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const numArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const replay = flag("--replay");
const swapFile = strArg("--swap");
const verbose = flag("--verbose");
const from = numArg("--from", 0);
const to = numArg("--to", Infinity);
const narrTemp = numArg("--temp", 0.8); // narration is unpinned in-app; fix it here so A/B seeds are comparable
const opts = parseArgs(process.argv);

const turns = JSON.parse(await readFile(file, "utf8"));
const sumOf = (t) => (t.requests?.find((r) => r.type === "summary")?.response || "").trim();

// Old→new digest map for the B arm, paired by turn index against the re-digested export.
const swap = new Map();
if (swapFile) {
  const red = JSON.parse(await readFile(swapFile, "utf8"));
  turns.forEach((t, i) => { const o = sumOf(t), n = sumOf(red[i]); if (o && n && o !== n) swap.set(o, n); });
}

const PLAN_MARK = "\n\nRough notes on what happens this turn";
/** Turn a recorded (plan-mode) narration request into a non-plan one: drop the plan, swap digests for B. */
function nonPlanMessages(narr) {
  return narr.messages.map((m, idx) => {
    if (idx === narr.messages.length - 1 && m.role === "user") {
      const cut = m.content.indexOf(PLAN_MARK);
      return { ...m, content: cut >= 0 ? m.content.slice(0, cut) : m.content };
    }
    if (m.role === "assistant" && swap.has((m.content || "").trim())) {
      return { ...m, content: swap.get(m.content.trim()) };
    }
    return m;
  });
}

const RUNS = replay ? Math.max(1, opts.runs) : 1;
const arm = swapFile ? "B (factual digests)" : "A (story-voice digests)";
console.log(`NON-PLAN NARRATION · ${file}`);
console.log(`${arm} · ${replay ? `LIVE "${opts.model}" temp ${narrTemp}` : "recorded"} · ${RUNS} run(s)/turn · turns ${from}..${to === Infinity ? turns.length - 1 : to}\n`);
console.log("turn  freeze  dialogue  defer  chars   manual  action");

const T = { n: 0, freeze: 0, dlg: 0, defer: 0, len: 0, turns: 0 };
for (let i = from; i <= Math.min(to, turns.length - 1); i++) {
  const narr = turns[i].requests?.find((r) => r.type === "narration");
  if (!narr) continue;
  const per = { freeze: 0, dlg: 0, defer: 0, len: 0 };
  let bad = false;
  for (let r = 0; r < RUNS; r++) {
    let out = narr.response || "";
    if (replay) {
      try { out = await callMessages({ ...opts, temp: narrTemp, maxTokens: 512, seed: opts.seed + r }, nonPlanMessages(narr)); }
      catch (e) { console.log(`${String(i).padStart(3)}  ERROR (run ${r}): ${String(e.message || e)}`); bad = true; break; }
    }
    const freeze = (out.match(FREEZE_RE) || []).length;
    const dlg = (out.match(QUOTE_RE) || []).length > 0 ? 1 : 0; // has quoted dialogue
    const defer = DEFER_RE.test(out) ? 1 : 0;
    T.n++; T.freeze += freeze; T.dlg += dlg; T.defer += defer; T.len += out.length;
    per.freeze += freeze; per.dlg += dlg; per.defer += defer; per.len += out.length;
    if (verbose) console.log(printOut(out, `    r${r} `));
  }
  if (bad) continue;
  T.turns++;
  const manual = /^[a-z]/.test((turns[i].action || "").trim()) ? "*" : " ";
  console.log(
    `${String(i).padStart(3)}  ${(per.freeze / RUNS).toFixed(1).padStart(5)}   ${per.dlg}/${RUNS}     ${per.defer}/${RUNS}   ${String(Math.round(per.len / RUNS)).padStart(4)}    ${manual}    ${(turns[i].action || "").slice(0, 42)}`,
  );
}

const pct = (x) => `${x}/${T.n} (${Math.round((100 * x) / T.n)}%)`;
console.log(`\n==== ${T.turns} turns × ${RUNS} runs = ${T.n} narration samples · ${arm} ====`);
console.log(`freeze ${(T.freeze / T.n).toFixed(2)}/sample · dialogue ${pct(T.dlg)} · deferral ${pct(T.defer)} · mean length ${Math.round(T.len / T.n)} chars`);
