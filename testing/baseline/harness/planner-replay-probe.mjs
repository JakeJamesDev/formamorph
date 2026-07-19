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

console.log("turn  freeze act spk def stall  echo  nDef manual  action");

const totals = { n: 0, freeze: 0, action: 0, speech: 0, defer: 0, stall: 0, echo: 0, echoN: 0, narrDefer: 0 };
let prevPlanText = "";
for (let i = from; i <= Math.min(to, turns.length - 1); i++) {
  const t = turns[i];
  const think = planOf(t);
  if (!think) continue;
  let planText = think.response || "";
  if (replay) {
    let messages = think.messages;
    if (rerender) {
      messages = messages.map((m) => (m.role === "system" ? { ...m, content: rerenderSystem(m.content) } : m));
    }
    try { planText = await callMessages({ ...opts, seed: opts.seed }, messages); }
    catch (e) { console.log(`${String(i).padStart(3)}   REPLAY ERROR: ${String(e.message || e)}`); continue; }
  }
  const beats = parsePlan(planText).beats || planText;
  const s = scorePlan(beats);
  const echo = prevPlanText ? jaccard(parsePlan(prevPlanText).beats || prevPlanText, beats) : 0;
  const manual = /^[a-z]/.test((t.action || "").trim()) ? "*" : " ";
  totals.n++;
  totals.freeze += s.freeze; if (s.npcAction) totals.action++; if (s.npcSpeech) totals.speech++;
  if (s.defer) totals.defer++; if (s.stall) totals.stall++;
  if (prevPlanText) { totals.echo += echo; totals.echoN++; }
  const nDef = narrDefer(t); if (nDef) totals.narrDefer++;
  console.log(
    `${String(i).padStart(3)}  ${String(s.freeze).padStart(6)} ${s.npcAction ? " Y " : " . "} ${s.npcSpeech ? " Y " : " . "} ${s.defer ? " D " : " . "} ${s.stall ? "STALL" : "  .  "} ${echo.toFixed(2)}${echo > 0.4 ? "!" : " "}  ${nDef ? " D " : " . "}   ${manual}    ${(t.action || "").slice(0, 60)}`,
  );
  if (verbose) console.log(printOut(planText, "        "));
  prevPlanText = planText;
}

const pct = (x) => `${x}/${totals.n} (${Math.round((100 * x) / totals.n)}%)`;
console.log(`\n==== ${totals.n} planner turns${replay ? " [LIVE]" : " [recorded]"} ====`);
console.log(`freeze ${(totals.freeze / totals.n).toFixed(1)}/turn · npc-action ${pct(totals.action)} · npc-speech ${pct(totals.speech)}`);
console.log(`plan-defer ${pct(totals.defer)} · narration-defer ${pct(totals.narrDefer)} · stalls ${pct(totals.stall)} · mean echo-vs-prev ${(totals.echo / (totals.echoN || 1)).toFixed(2)} (turns >0.4 flagged with !)`);
console.log(`( * = manual action: the player had to author it because choices didn't advance )`);
