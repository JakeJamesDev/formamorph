// Planner probe #1 — ACTION INTEGRATION. Reproduces the session's turn-27 defect: the planner echoed a
// prior turn's plan and never processed the resubmitted action. Each case hands the planner a recap plus a
// NEW action that introduces something absent from the recap; a working planner reflects that new content
// in its Scene/Beats, and does NOT just restate the recap. Metrics per run:
//   - integrated: at least one of the action's distinctive `must` cues appears in the plan
//   - echo: Jaccard word-overlap of the plan's Beats with the recap (high ⇒ regurgitating history)
//
// Usage:  node planner-action-integration-probe.mjs [--model cydonia-24b-v4.3@q4_k_m] [--runs 3] [--only reveal]

import {
  parseArgs, renderThinkingSys, buildThinkingUser, callPlanner, parsePlan, jaccard, printOut,
} from "./planner-probe-lib.mjs";

const WORLD = "A grounded, modern-day adult romance. Two consenting adults, alone, mutual attraction already established. Scenes are character-driven and advance on the player's action.";
const LOC = "Sarah's apartment";
const SARAH = { name: "Sarah", description: "AGE: 27. A confident, warm woman, into the player and unhurried about it.", type: "Person" };

const CASES = [
  {
    name: "new-object",
    entities: [SARAH],
    recap: "You and Sarah are close on the couch, the conversation gone soft and unhurried, her knee resting against yours.",
    action: "I get up, take the polaroid camera off the shelf, and turn to snap a photo of her.",
    must: ["polaroid", "camera", "photo", "picture", "snap", "shutter", "flash", "lens"],
    note: "Plan must integrate the camera/photo, not continue generic couch talk.",
  },
  {
    name: "topic-shift",
    entities: [SARAH],
    recap: "You've been trading stories about music, easy and flirtatious, Sarah laughing at something you said.",
    action: "I go still and ask her point-blank whether she's seeing anyone else right now.",
    must: ["seeing", "anyone", "someone", "single", "dating", "exclusive", "else"],
    note: "Sarah should address the relationship question, not keep chatting about music.",
  },
  {
    name: "direct-request",
    entities: [SARAH],
    recap: "Sarah is curled against your side, tracing idle shapes on the back of your hand, both of you quiet.",
    action: "I ask her to tell me the one thing about herself she's never told anyone.",
    must: ["secret", "never told", "confession", "admits", "reveals", "tells you", "truth"],
    note: "Sarah should actually begin to answer (a confession), not restate the cuddling.",
  },
  {
    name: "resubmit-echo",
    entities: [SARAH],
    // Recap is itself vivid and plan-like — the trap that made turn 27 echo. The action is a fresh, concrete instruction.
    recap: "Sarah leans in close, her breath warm against your ear as she whispers how much she's wanted this, one hand splayed flat against your chest.",
    action: "I take her by the wrist, stand us both up, and lead her toward the bedroom door.",
    must: ["wrist", "stand", "stands", "up", "lead", "leads", "bedroom", "door", "hallway", "walk"],
    note: "Plan must follow the move toward the bedroom, not re-describe the whisper-on-the-couch recap.",
  },
];

const opts = parseArgs(process.argv);
const pick = CASES.filter((c) => !opts.only || c.name.includes(opts.only));
console.log(`Planner ACTION-INTEGRATION · ${opts.endpoint} · "${opts.model}" · ${pick.length} case(s) · ${opts.runs} run(s)/case\n`);

const totals = { runs: 0, integrated: 0, echo: 0 };
for (const c of pick) {
  const sys = renderThinkingSys({ world: WORLD, playerTrait: "Jessica, an adult woman", location: LOC, entities: c.entities });
  const user = buildThinkingUser(c.recap, c.action);
  let integ = 0;
  console.log(`\n######## ${c.name} — ${c.note}`);
  for (let r = 0; r < opts.runs; r++) {
    let out, err = null;
    try { out = await callPlanner({ ...opts, seed: opts.seed + r }, sys, user); }
    catch (e) { err = String(e.message || e); }
    totals.runs++;
    if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
    const plan = parsePlan(out);
    const hay = (plan.scene + " " + plan.beats + " " + plan.cast).toLowerCase();
    const integrated = c.must.some((m) => hay.includes(m.toLowerCase()));
    const echo = jaccard(plan.beats || out, c.recap);
    if (integrated) { integ++; totals.integrated++; }
    totals.echo += echo;
    console.log(`  #${r + 1} ${integrated ? "INTEGRATED" : "IGNORED   "} · echo ${echo.toFixed(2)}${echo > 0.35 ? " (HIGH — restating recap)" : ""}`);
    console.log(printOut(out));
  }
  console.log(`  -> ${c.name}: integrated ${integ}/${opts.runs}`);
}
console.log(`\n==== integrated ${totals.integrated}/${totals.runs} · mean echo ${(totals.echo / totals.runs).toFixed(2)} (lower is better) ====`);
