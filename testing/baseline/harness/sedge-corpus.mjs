// Neutral base corpus — the Sedge Landing world as a self-play seed, so a long-session sweep can be run
// in a genre that is NOT the charged/intimate one. Every sampler and prompt finding so far comes from
// charged-speech-corpus, and a setting that helps an intimate scene is not automatically right for a
// grounded, talky one. Same shape as charged-corpus.mjs: freeze-script consumes WORLD/PLAYER_TRAIT/
// LOCATION/ENTITIES and the opening TURNS, then plays the rest itself.

export const WORLD =
  "A grounded, low-fantasy river crossing. The Ashen River runs milk-pale and silent past a rickety landing; a rope ferry is the only way over, and the far bank is watched. People here are practical, superstitious about the water, and short with strangers. Nothing supernatural happens on the page - the strangeness is in the river's reputation, not in events.";
export const PLAYER_TRAIT = "a traveler who came down to the landing on foot, carrying a mapmaker's case and needing to reach the far bank.";
export const LOCATION = "Sedge Landing - a rickety wooden dock on the north bank, a single lantern on a post, the gloamwater running dead silent below.";
export const ENTITIES = [
  { name: "Bram", type: "Person", description: "AGE 50s. The ferryman: broad and weathered, with only his right arm - the left sleeve is pinned up - and a brass ring through his left ear. Speaks in short dry sentences and does not repeat himself." },
  { name: "Odette", type: "Person", description: "AGE 30s. A small, quick woman smoking river-eels over a firepit at the landing while she waits to cross. A burn scar across her right cheek, a green glass bead braided into her hair. Curious, talkative, and happy to gossip about anyone not present." },
];

// Seeded speech turns for the long-session sweep — vague, mood-bearing, and fitted to THIS world's cast
// and stakes (getting across the river), so the probe measures neutral-genre speech rather than the
// charged corpus's.
export const SPEECH_TURNS = [
  { action: "I tell him what I think of his ferry.", mood: "frustrated, out of patience" },
  { action: "I tell her why I need to be across before dark.", mood: "urgent, level" },
  { action: "I ask him what it would take to change his mind.", mood: "practical, bargaining" },
  { action: "I admit I don't know the river the way they do.", mood: "candid, a little embarrassed" },
  { action: "I ask her what she isn't telling me about the water.", mood: "wary, pressing" },
];

export const TURNS = [
  { action: "I set my case down on the dock boards and ask Bram when the next crossing is." },
  { action: "I crouch by Odette's firepit and warm my hands." },
  { action: "I ask Odette what the ferryman is like to deal with." },
  { action: "I look out at the gloamwater and ask why it runs so quiet." },
];
