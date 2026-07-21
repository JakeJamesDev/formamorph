// Charged-interview corpus — 25 consecutive BAITED turns (plus one unscored opener): every action
// directly asks a named, willing partner to speak, through an intimate escalation. The strict-dialogue
// probe (dialogue-hold-probe.mjs) scores each turn: an NPC must speak >=2 quoted sentences that engage
// the ask. The failure this hunts is dialogue-frequency DECAY across the run — a downward trend is a
// fail even when the average looks fine. World/cast shared with charged-corpus.mjs (willing, forward,
// talkative partners: silence or a non-answer is the model failing, never the authored characters).

export { WORLD, PLAYER_TRAIT, LOCATION, ENTITIES } from "./charged-corpus.mjs";

// Opener sets the scene and is never scored.
export const OPENER = "I come home to find Mara and Sofia already curled together on the couch in the lamplight.";

// 25 baited actions: each one explicitly requests speech (a question, or an ask-to-say). Wording varies
// deliberately so lexical monotony doesn't seed echo.
export const TURNS = [
  "I settle in between them and ask how their day treated them both.",
  "I ask Mara what she's been wanting to do with our evening.",
  "I turn to Sofia and ask her to tell me what she's thinking right now.",
  "I ask them both what sounds better: staying right here, or somewhere softer.",
  "I ask Mara to describe what she likes most about nights like this.",
  "I lean close to Sofia and ask what she'd want if she could have anything tonight.",
  "I ask Mara whether she remembers our first night together, and what she remembers best.",
  "I ask Sofia to tell me honestly how she wants this evening to go.",
  "I take Mara's hand and ask if she wants to lead the way tonight.",
  "I ask Sofia what she wants me to do next.",
  "I draw them both up toward the bedroom and ask who wants the first kiss.",
  "I ask Mara to tell me exactly what she's feeling as I pull her close.",
  "I kiss Sofia's neck and ask her to tell me if she likes it.",
  "I ask Mara what she wants me to take off first.",
  "I ask Sofia to say out loud what she's been imagining all day.",
  "I ask Mara how she wants the three of us to fit together.",
  "I ask Sofia to keep talking to me while I touch her.",
  "I ask Mara to tell me what feels good.",
  "I pause and ask them both what they want more of.",
  "I ask Sofia to whisper what she wants next in my ear.",
  "I ask Mara if she likes watching us, and what she sees.",
  "I ask Sofia to tell me when she's close.",
  "I ask Mara what she wants to hear from me right now.",
  "I ask them both what tonight has meant so far.",
  "I ask Sofia what we should do with the rest of our night.",
];
