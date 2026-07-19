// Planner probe #2 — CONTINUATION vs REACTION. Reproduces the session's turn 46-48 stall: the planner kept
// emitting reaction-only beats (the partner "goes still", "processes", "the moment hangs suspended") and
// never had her act or speak, so the scene froze and the player re-input the same line three times. A working
// planner advances: the present character takes the next physical action AND speaks a line (the current
// planner prompt asks for spoken words in Beats). Metrics per run, scored on the Beats section:
//   - freeze: count of reaction-freeze phrases (goes still / processes / hangs suspended / grip tightens ...)
//   - npcAction: a forward physical action by the NPC is present (not merely a reaction)
//   - npcSpeech: at least one quoted line of NPC dialogue
// A stall = high freeze with no npcAction and no npcSpeech.
//
// Includes one negative control (`player-withdraws`) where pausing IS correct — a fix must not steamroll a stop.
//
// Usage:  node planner-continuation-probe.mjs [--model cydonia-24b-v4.3@q4_k_m] [--runs 3] [--only baby]

import {
  parseArgs, renderThinkingSys, buildThinkingUser, callPlanner, parsePlan, printOut,
} from "./planner-probe-lib.mjs";

const WORLD = "A grounded, modern-day adult romance. Two consenting adults, alone together, mutual desire established and escalating. The scene should keep moving under its own momentum.";
const LOC = "Sarah's apartment";
const SARAH = { name: "Sarah", description: "AGE: 27. Confident and warm, very into the player, forward and talkative rather than shy.", type: "Person" };

const CASES = [
  {
    name: "escalate-kiss",
    recap: "You've been leaning into each other on the couch for a while; Sarah just kissed you, slow and certain, and pulled back only far enough to watch your face.",
    action: "I kiss her back harder and pull her closer against me.",
    expects: "Sarah acts on the escalation and says something — not a frozen reaction shot.",
  },
  {
    name: "spoken-declaration",
    // The exact stall shape: a charged spoken line to which the NPC must RESPOND, not just process.
    recap: "The two of you are tangled together, breathless, foreheads resting against each other in the low light.",
    action: "I hold her gaze and tell her I want her to stay the night.",
    expects: "Sarah answers aloud and moves — accepts, teases, pulls you in — rather than going still and 'processing'.",
  },
  {
    name: "invite-forward",
    recap: "Sarah has you backed against the kitchen counter, one hand flat on your waist, grinning at how flustered you are.",
    action: "I take her hand and tell her to take me to bed.",
    expects: "Sarah leads/moves and speaks — the scene advances toward the bedroom.",
  },
  {
    name: "player-withdraws",   // NEGATIVE CONTROL — pausing is correct here; a fix must not force momentum
    recap: "Things were escalating fast on the couch, both of you breathing hard.",
    action: "I gently pull back, put a hand on her chest, and say I need a second.",
    expects: "CONTROL: Sarah reads the pause and eases off — she should NOT be steamrolled forward.",
    control: true,
  },
];

const FREEZE_RE = /\b(goes? (?:completely )?still|stills|freezes?|goes? rigid|motionless|hangs? (?:suspended|in the air)|processes?|processing|registers?|takes? in (?:the|your) words|breath (?:catches|hitches)|pupils? dilat\w*|eyes? widen\w*|grip tighten\w*|tightens? (?:her|his|their) grip|goes? quiet|says? nothing|frozen|suspended|unspoken)\b/gi;
const NPC_FORWARD_RE = /\b(reaches?|pulls?|slides?|leans? in|presses? forward|guides?|takes? your|takes? his|takes? her|tugs?|unbutton\w*|unzip\w*|stands?|rises?|moves? (?:to|toward|closer)|steps?|kisses?|deepen\w*|grabs?|lifts?|draws? you|answers?|replies?|nods? and|tells? you|leads?|whispers? back|climbs?|shifts? (?:to|onto)|wraps?)\b/gi;
const QUOTE_RE = /("[^"]{2,}"|[“][^”]{2,}[”])/g;

const opts = parseArgs(process.argv);
const pick = CASES.filter((c) => !opts.only || c.name.includes(opts.only));
console.log(`Planner CONTINUATION vs REACTION · ${opts.endpoint} · "${opts.model}" · ${pick.length} case(s) · ${opts.runs} run(s)/case\n`);

const totals = { runs: 0, freeze: 0, npcAction: 0, npcSpeech: 0, stall: 0 };
for (const c of pick) {
  const sys = renderThinkingSys({ world: WORLD, playerTrait: "Jessica, an adult woman", location: LOC, entities: [SARAH] });
  const user = buildThinkingUser(c.recap, c.action);
  console.log(`\n######## ${c.name} — ${c.expects}`);
  for (let r = 0; r < opts.runs; r++) {
    let out, err = null;
    try { out = await callPlanner({ ...opts, seed: opts.seed + r }, sys, user); }
    catch (e) { err = String(e.message || e); }
    totals.runs++;
    if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
    const beats = parsePlan(out).beats || out;
    const freeze = (beats.match(FREEZE_RE) || []).length;
    const npcAction = NPC_FORWARD_RE.test(beats);
    const npcSpeech = QUOTE_RE.test(beats);
    const stall = freeze >= 2 && !npcAction && !npcSpeech;
    totals.freeze += freeze;
    if (npcAction) totals.npcAction++;
    if (npcSpeech) totals.npcSpeech++;
    if (stall && !c.control) totals.stall++;
    console.log(`  #${r + 1} ${stall ? "STALL" : "MOVES"} · freeze ${freeze} · npc-action ${npcAction ? "Y" : "n"} · npc-speech ${npcSpeech ? "Y" : "n"}${c.control ? " · [control]" : ""}`);
    console.log(printOut(out));
  }
}
console.log(`\n==== freeze ${(totals.freeze / totals.runs).toFixed(1)}/run · npc-action ${totals.npcAction}/${totals.runs} · npc-speech ${totals.npcSpeech}/${totals.runs} · STALLS ${totals.stall} (non-control) ====`);
