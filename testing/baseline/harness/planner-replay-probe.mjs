// Planner REPLAY probe — turns a real "AI Context" export into a scored planner regression suite.
//
// It reads an exported ai-context JSON (array of turns, each `{ action, requests[], turnId }`) and, for every
// turn that carried a `thinking` request, scores the planner's plan for the three confirmed failure
// signatures — plus a deferral check and a turn-to-turn echo. This is the oracle the synthetic probes can't
// be: a short clean context hides these bugs; the real accumulated history reproduces them.
//
// Two modes:
//   (default, OFFLINE) score the plans the session already recorded — no model needed. Quantifies the defects
//                      across the whole run; use it to characterize a bad session.
//   --replay           re-fire each turn's EXACT recorded messages through the model (thinking sampler pins)
//                      and score the FRESH plan. Use this to A/B a prompt/sampler change against real contexts:
//                      edit GamePrompts.ts is NOT enough here (the export baked its own system prompt) — see note.
//
// Metrics per turn (on the plan's Beats): freeze count · npc-action · npc-speech · defer (asks the player) ·
// stall (freeze≥2 & no action & no speech) · echo (Jaccard vs the PREVIOUS turn's plan — the turn-27 defect).
//
// Usage:
//   node planner-replay-probe.mjs "D:/Downloads/ai-context-long session.json"
//   node planner-replay-probe.mjs <file> --replay --model cydonia-24b-v4.3@q4_k_m [--from 20 --to 30] [--verbose]
//
// Note on --replay fidelity: it replays the messages AS RECORDED, so it tests the *model/sampler* against the
// real context, not an edited prompt. To test a GamePrompts.ts edit, use the synthetic loaded-history probe
// instead (or extend this to re-render the system message from source — a deliberate next step, not done here).

import { readFile } from "node:fs/promises";
import { parseArgs, parsePlan, jaccard, scorePlan, DEFER_RE, callMessages, grab, printOut } from "./planner-probe-lib.mjs";

// Splice the CURRENT (edited) planner template's framing onto the real recorded data block, so a
// GamePrompts.ts edit is testable against the real recap/entities. Both share the "## Game World" (data
// start) and "Respond in exactly this format:" (tail start) markers.
function rerenderSystem(recordedSys) {
  const START = "## Game World", END = "Respond in exactly this format:";
  const data = recordedSys.slice(recordedSys.indexOf(START), recordedSys.indexOf(END)).trimEnd();
  const tmpl = grab("defaultThinkingPrompt");
  return tmpl.slice(0, tmpl.indexOf(START)) + data + "\n\n" + tmpl.slice(tmpl.indexOf(END));
}

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--")) || null;
if (!file) { console.error("Provide an ai-context export path as the first argument."); process.exit(1); }
const flag = (f) => argv.includes(f);
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const replay = flag("--replay");
const rerender = flag("--rerender"); // replay with the CURRENT template's framing spliced onto real data
const verbose = flag("--verbose");
const from = num("--from", 0);
const to = num("--to", Infinity);
const opts = parseArgs(process.argv);

const raw = JSON.parse(await readFile(file, "utf8"));
const turns = Array.isArray(raw) ? raw : Object.values(raw);

const planOf = (t) => t.requests?.find((r) => r.type === "thinking");
// The recorded thinking user message holds the recap; the action is the turn's `action`.
const recapOf = (think) => {
  const u = think.messages?.find((m) => m.role === "user")?.content || "";
  const m = u.match(/(?:What just happened|Earlier events):\n([\s\S]*?)\n\nThe player's next action:/i);
  return m ? m[1] : "";
};

console.log(`Planner REPLAY · ${file}`);
console.log(`${replay ? `LIVE re-fire · "${opts.model}"` : "OFFLINE (scoring recorded plans)"} · turns ${from}..${to === Infinity ? turns.length - 1 : to}\n`);
// Deferral shows up more in the narration/choices than the plan, so score the recorded narration too — it's
// the clearest signal for the "character asks the player what to do" failure. (Narration is never re-fired.)
const narrDefer = (t) => {
  const n = t.requests?.find((r) => r.type === "narration")?.response || "";
  return DEFER_RE.test(n);
};

// Recorded mode has one baked plan per turn; live mode fires --runs samples (varied seed) to beat noise.
const RUNS = replay ? Math.max(1, opts.runs) : 1;
console.log(`runs/turn: ${RUNS}${replay ? ` (seeds ${opts.seed}..${opts.seed + RUNS - 1})` : ""}\n`);
console.log("turn  freeze  stall  act  spk  def  echo  nDef  manual  action");

// Plan metrics accumulate over every turn×run sample (n = turns × RUNS). Narration-defer is per turn.
const totals = { n: 0, freeze: 0, action: 0, speech: 0, defer: 0, stall: 0, echo: 0, echoN: 0, narrDefer: 0, turns: 0 };
const prevPlanByRun = {}; // run index -> previous turn's plan (paired echo)
for (let i = from; i <= Math.min(to, turns.length - 1); i++) {
  const t = turns[i];
  const think = planOf(t);
  if (!think) continue;
  const per = { freeze: 0, stall: 0, action: 0, speech: 0, defer: 0 };
  let bad = false;
  for (let r = 0; r < RUNS; r++) {
    let planText = think.response || "";
    if (replay) {
      let messages = think.messages;
      if (rerender) messages = messages.map((m) => (m.role === "system" ? { ...m, content: rerenderSystem(m.content) } : m));
      try { planText = await callMessages({ ...opts, seed: opts.seed + r }, messages); }
      catch (e) { console.log(`${String(i).padStart(3)}   REPLAY ERROR (run ${r}): ${String(e.message || e)}`); bad = true; break; }
    }
    const beats = parsePlan(planText).beats || planText;
    const s = scorePlan(beats);
    const prev = prevPlanByRun[r];
    const echo = prev ? jaccard(parsePlan(prev).beats || prev, beats) : 0;
    totals.n++;
    totals.freeze += s.freeze; if (s.npcAction) totals.action++; if (s.npcSpeech) totals.speech++;
    if (s.defer) totals.defer++; if (s.stall) totals.stall++;
    if (prev) { totals.echo += echo; totals.echoN++; }
    per.freeze += s.freeze; if (s.stall) per.stall++; if (s.npcAction) per.action++; if (s.npcSpeech) per.speech++; if (s.defer) per.defer++;
    prevPlanByRun[r] = planText;
    if (verbose) console.log(printOut(planText, `    r${r} `));
  }
  if (bad) continue;
  totals.turns++;
  const nDef = narrDefer(t); if (nDef) totals.narrDefer++;
  const manual = /^[a-z]/.test((t.action || "").trim()) ? "*" : " ";
  console.log(
    `${String(i).padStart(3)}  ${(per.freeze / RUNS).toFixed(1).padStart(5)}  ${String(per.stall).padStart(2)}/${RUNS}  ${per.action}/${RUNS} ${per.speech}/${RUNS} ${per.defer}/${RUNS}  ` +
    `      ${nDef ? " D " : " . "}    ${manual}    ${(t.action || "").slice(0, 46)}`,
  );
}

const pct = (x) => `${x}/${totals.n} (${Math.round((100 * x) / totals.n)}%)`;
console.log(`\n==== ${totals.turns} turns × ${RUNS} runs = ${totals.n} plan samples${replay ? " [LIVE]" : " [recorded]"} ====`);
console.log(`freeze ${(totals.freeze / totals.n).toFixed(2)}/sample · npc-action ${pct(totals.action)} · npc-speech ${pct(totals.speech)}`);
console.log(`plan-defer ${pct(totals.defer)} · stalls ${pct(totals.stall)} · mean echo-vs-prev ${(totals.echo / (totals.echoN || 1)).toFixed(2)} · narration-defer ${totals.narrDefer}/${totals.turns} turns`);
console.log(`( * = manual action: the player had to author it because choices didn't advance )`);
