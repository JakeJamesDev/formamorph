// Charged-interview corpus v2 — 25 consecutive BAITED turns (plus one unscored opener): every action
// directly asks a named, willing partner to speak. v2 DE-CONFOUNDS position vs charge: conversational
// (cool) and physical (hot) asks interleave across the whole run, so a participation drop over turn index
// means TIME/register decay, while a cool-vs-hot gap means CHARGE — v1 escalated monotonically and
// entangled the two. The strict-dialogue probe (dialogue-hold-probe.mjs) scores each turn: an NPC must
// speak >=2 quoted sentences that engage the ask; a downward trend is a FAIL even when the average looks
// fine. World/cast shared with charged-corpus.mjs (willing, forward, talkative partners: silence or a
// non-answer is the model failing, never the authored characters).

export { WORLD, PLAYER_TRAIT, LOCATION, ENTITIES } from "./charged-corpus.mjs";

// Opener sets the scene and is never scored.
export const OPENER = "I come home to find Mara and Sofia already curled together on the couch in the lamplight.";

// 25 baited actions, alternating cool (hot:false — conversational asks) and hot (hot:true — physical
// escalation asks). Each window of the run carries a near-even mix. Wording varies deliberately so
// lexical monotony doesn't seed echo.
export const TURNS = [
  { a: "I settle in between them and ask how their day treated them both.", hot: false },
  { a: "I pull Mara into a slow kiss and ask her to tell me what she wants tonight.", hot: true },
  { a: "I ask Sofia to tell me the story of the first time she knew she loved us.", hot: false },
  { a: "I trail my hand up Mara's thigh and ask if she likes where this is going.", hot: true },
  { a: "I ask Mara what she'd want to do together this weekend, just the three of us.", hot: false },
  { a: "I kiss Sofia's neck and ask her to tell me if she likes it.", hot: true },
  { a: "I ask Sofia what she's been reading lately and whether I'd like it.", hot: false },
  { a: "I ask Mara what she wants me to take off first.", hot: true },
  { a: "I ask Mara to tell me honestly how work has been treating her.", hot: false },
  { a: "I draw Sofia closer by the waist and ask her to say out loud what she's been imagining all day.", hot: true },
  { a: "I ask them both what tonight has meant so far.", hot: false },
  { a: "I ask Mara how she wants the three of us to fit together.", hot: true },
  { a: "I laugh and ask Sofia to tell me the worst pickup line she's ever heard.", hot: false },
  { a: "I ask Sofia to keep talking to me while I touch her.", hot: true },
  { a: "I ask Mara what she remembers best about our first night together.", hot: false },
  { a: "I ask Mara to tell me what feels good.", hot: true },
  { a: "I ask Sofia where she'd want us to travel next year, and why.", hot: false },
  { a: "I pause and ask them both what they want more of.", hot: true },
  { a: "I ask Mara to tell me something about herself I still don't know.", hot: false },
  { a: "I ask Sofia to whisper what she wants next in my ear.", hot: true },
  { a: "I ask them both how they'd describe us to a stranger.", hot: false },
  { a: "I ask Mara if she likes watching us, and what she sees.", hot: true },
  { a: "I ask Sofia what song she'd put on right now, and why that one.", hot: false },
  { a: "I ask Mara to tell me when she's close.", hot: true },
  { a: "I ask them both what we should do with the rest of our night.", hot: false },
];
