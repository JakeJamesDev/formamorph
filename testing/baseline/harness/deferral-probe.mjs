// DEFERRAL probe — the measuring stick for failure #1 ("the AI won't advance: it asks the player what to do,
// hands the decision back, or only offers ways to retreat"). The freeze work fixed the register; this targets
// the OTHER headline failure, which lives in the narration + choices stages, not the summary.
//
// Deferral was too rare in the one real session (~3/34 turns) to measure by replay alone, so this probe uses a
// PROVOKING corpus: charged-but-tasteful "decision-handoff" scenes where the player has just committed to
// advancing and the tempting-but-wrong move is to bounce the decision back ("are you sure?", end on a question
// to the player, or offer only retreat options). A healthy pipeline advances under the characters' own momentum.
//
// Two surfaces, scored independently:
//   narration — fire defaultSystemPrompt from recap+action. Score: defer-phrase (DEFER_RE) · ends-on-a-question
//               -to-the-player. This is the "narration asks the player" failure.
//   choices   — fire defaultChoicesPrompt from an AUTHORED charged narration (so the score doesn't ride on
//               narration variance). Score: retreat-option share · has-a-forward-option. This is the
//               "options only let me back out" failure.
//
// Diagnosis (Step 0): if deferral is ~0 here on CLEAN context but shows up on the real session replay
// (planner-replay-probe narration-defer), it's context/recap-driven like freeze was — prompt wording won't fix
// it, and the real lever is the hydration/state-ledger redesign. If it fires HERE too, it's a contract gap we
// can write against.
//
//   node deferral-probe.mjs [--runs 5] [--temp 0.7] [--only kiss] [--verbose]

import { parseArgs, grab, callMessages, DEFER_RE } from "./planner-probe-lib.mjs";

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const strArg = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const numArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
const opts = parseArgs(process.argv, { runs: "5" });
const RUNS = Math.max(1, numArg("--runs", 5));
const TEMP = numArg("--temp", 0.7); // narration/choices are UNPINNED in-game — inherit endpoint default (~0.7)
const only = strArg("--only");
const verbose = flag("--verbose");

const NARR = grab("defaultSystemPrompt");
const CHOICES = grab("defaultChoicesPrompt");
const CHOICES_USER = grab("defaultChoicesUserPrompt");

// ── Shared world for the corpus (grounded, consenting-adult romance; mutual desire already established). ──
const WORLD = "A grounded modern-day adult romance. Two consenting adults, mutual desire established and escalating; scenes should keep moving under their own momentum rather than stalling for permission.";
const SARAH = "Sarah — AGE 27. Confident, warm, forward and talkative rather than shy; very into the player.";

// Fill a narration/choices template with a case's fields; unused data blocks → N/A.
function fillNarr(recap) {
  return NARR
    .replaceAll("<LENGTH GUIDANCE>", "Two or three short paragraphs.")
    .replaceAll("<MARKDOWN GUIDANCE>", "Write immersive, flowing prose - never a list or menu.")
    .replaceAll("<WORLD DESCRIPTION>", WORLD)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "N/A")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", "- **Identity:** Jessica, an adult woman")
    .replaceAll("<NOTES>", recap ? `Immediately before this: ${recap}` : "None")
    .replaceAll("<LOCATION|markdown>", "- **name:** Sarah's apartment")
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", `- **${SARAH}**`)
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");
}
function fillChoices() {
  return CHOICES
    .replaceAll("<WORLD DESCRIPTION>", WORLD)
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "N/A")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", "- **Identity:** Jessica, an adult woman")
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|summary.markdown>", "- **name:** Sarah's apartment")
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", `- **${SARAH}**`)
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A");
}

// Decision-handoff cases: the player commits to advancing; the authored narration ends on a beat that a
// deferring pipeline would answer with a question or a retreat. `recap` seeds the narration fire; `narration`
// is the authored charged-but-tasteful passage the choices stage scores against.
const CASES = [
  { name: "take-to-bed",
    recap: "Sarah has you backed against the kitchen counter, grinning at how flustered you are; the tension has been building all night.",
    action: "I take her hand and tell her to take me to bed.",
    narration: `Sarah's grin softens into something warmer. She laces her fingers through yours and steps back toward the hall, tugging you off the counter. "About time," she murmurs, and leads you down the dim corridor to her room, pulling you in after her.` },
  { name: "kiss-deeper",
    recap: "You've been leaning into each other on the couch; Sarah just kissed you, slow and certain, and pulled back only far enough to watch your face.",
    action: "I kiss her back harder and pull her closer against me.",
    narration: `She makes a low, pleased sound against your mouth and melts into you, one knee sliding up over your lap. Her hand finds the back of your neck and holds you there, the kiss going deep and unhurried, the whole room narrowing to the warm press of her.` },
  { name: "stay-the-night",
    recap: "The two of you are tangled together, breathless, foreheads resting against each other in the low light.",
    action: "I tell her I want her to stay the night.",
    narration: `"Then I'll stay," she says, no hesitation, and kisses the corner of your jaw. She reaches past you to switch off the lamp, and in the dark her arm settles heavy and certain across your waist, pulling you back against her.` },
  { name: "undress",
    recap: "You're pressed together against the bedroom door, both of you already breathing hard, her hands fisted in your shirt.",
    action: "I start unbuttoning her blouse.",
    narration: `She doesn't stop you — just tips her head back against the door and lets out a shaky breath as the first button gives. "Yes," she says, quiet and certain, her own hands dropping to help you, fingers brushing yours at the next button.` },
  { name: "pull-down",
    recap: "Sarah has climbed into your lap on the couch, holding your face in both hands, the last of the small talk long gone.",
    action: "I wrap my arms around her and pull her down onto the couch with me.",
    narration: `She goes with it easily, laughing low as you both tip sideways into the cushions, her weight settling warm along the length of you. "Finally," she breathes against your throat, and her mouth finds the pulse there, unhurried and sure.` },
  { name: "reunion",
    recap: "You haven't seen Sarah in years; she just pulled you into a tight hug at the door, laughing through it.",
    action: "I hold her close and tell her how much I missed her.",
    narration: `"God, me too," she says into your shoulder, arms tightening. She pulls back just enough to look at you, eyes bright and wet, then laughs and swipes at them. "Get in here, you're letting the cold in," and she hauls you over the threshold by the front of your coat.` },
  { name: "hand-guides",
    recap: "You're lying together in the low light, her heartbeat quick under your palm, the pace of things clearly turning.",
    action: "I let my hand drift lower along her side.",
    narration: `She covers your hand with hers — not to stop it, but to press it flatter against her skin, guiding it lower along the curve of her hip. "Keep going," she says, the words warm against your ear, and shifts to give you room.` },
];

// ── Detectors ──
// A question aimed at the player (deferral's narration face): the passage ends on a "?" and the trailing
// question addresses "you" or asks what you want. Authored narrations end on a beat, so any "?" is the model's.
function endsOnPlayerQuestion(text) {
  const t = text.trim();
  if (!t.endsWith("?")) return false;
  const lastQ = (t.match(/[^.?!]*\?\s*$/)?.[0] || t).toLowerCase();
  return /\byou\b|\bwant\b|\bready\b|\bsure\b|\bshould i\b|\bshall\b/.test(lastQ);
}
// A choices option that only lets the player retreat / stall / seek reassurance instead of engaging.
const RETREAT_RE = /\b(step back|pull away|pull back|slow (?:down|things)|hold off|hold back|hesitate|pause|wait a (?:moment|beat|second)|take a (?:break|moment)|give (?:her|him|them) space|second thoughts|back off|not sure|make sure (?:she|he|they)('?s| is| are)? (?:okay|ready|comfortable|sure)|ask (?:her|him|them) (?:if|whether)|check (?:that )?(?:she|he|they)('?s| is| are)? (?:okay|ready|sure))\b/i;
const optionsOf = (raw) => raw.split("\n").map((l) => l.trim())
  .filter((l) => /^i\b/i.test(l.replace(/^[-*\d.)\s]+/, "")))
  .map((l) => l.replace(/^[-*\d.)\s]+/, ""));

const call = (msgs, seed) => callMessages({ ...opts, temp: TEMP, maxTokens: 320, seed }, msgs);

console.log(`DEFERRAL (clean context) · "${opts.model}" · runs ${RUNS} · temp ${TEMP}\n`);
console.log("case            | narr: defer / ends-? / n | choices: retreat-share / has-forward");

const T = { nDefer: 0, nEndsQ: 0, nN: 0, retreat: 0, optN: 0, hasFwd: 0, cN: 0 };
for (const c of CASES.filter((c) => !only || c.name.includes(only))) {
  let nDefer = 0, nEndsQ = 0, retreatOpts = 0, totalOpts = 0, hasFwd = 0;
  for (let r = 0; r < RUNS; r++) {
    // Narration surface.
    const narr = await call([
      { role: "system", content: fillNarr(c.recap) },
      { role: "user", content: c.action },
    ], opts.seed + r);
    if (DEFER_RE.test(narr)) { nDefer++; T.nDefer++; }
    if (endsOnPlayerQuestion(narr)) { nEndsQ++; T.nEndsQ++; }
    T.nN++;
    if (verbose) console.log(`  [${c.name} r${r} NARR] ${narr.replace(/\s+/g, " ").slice(0, 200)}`);

    // Choices surface (on the authored narration, so the score is about the choices stage alone).
    const choices = await call([
      { role: "system", content: fillChoices() },
      { role: "user", content: CHOICES_USER.replaceAll("<NARRATION>", c.narration) },
    ], opts.seed + r);
    const opt = optionsOf(choices);
    const retreat = opt.filter((o) => RETREAT_RE.test(o)).length;
    retreatOpts += retreat; totalOpts += opt.length;
    T.retreat += retreat; T.optN += opt.length;
    const fwd = opt.length > retreat; if (fwd) { hasFwd++; T.hasFwd++; }
    T.cN++;
    if (verbose) console.log(`  [${c.name} r${r} CHOICES ${retreat}/${opt.length} retreat] ${opt.join(" | ")}`);
  }
  const share = totalOpts ? Math.round((100 * retreatOpts) / totalOpts) : 0;
  console.log(`${c.name.padEnd(15)} |   ${String(nDefer).padStart(2)}/${RUNS}   ${String(nEndsQ).padStart(2)}/${RUNS}  ${RUNS} |   ${String(share).padStart(3)}%          ${hasFwd}/${RUNS}`);
}

const pc = (k, n) => (n ? `${Math.round((100 * k) / n)}%` : "—");
console.log(`\n==== deferral, clean context (${T.nN} narration + ${T.cN} choices samples) ====`);
console.log(`NARRATION defer-phrase ${pc(T.nDefer, T.nN)} (${T.nDefer}/${T.nN}) · ends-on-player-question ${pc(T.nEndsQ, T.nN)} (${T.nEndsQ}/${T.nN})`);
console.log(`CHOICES  retreat-option share ${pc(T.retreat, T.optN)} (${T.retreat}/${T.optN} options) · has-a-forward-option ${pc(T.hasFwd, T.cN)} (${T.hasFwd}/${T.cN})`);
console.log(`\nDIAGNOSIS: near-0 here vs >0 on the real-session replay ⇒ deferral is context/recap-driven (like freeze),`);
console.log(`           not a prompt-contract gap. Compare against: planner-replay-probe.mjs <export> narration-defer.`);
