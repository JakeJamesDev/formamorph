// Charged-scene corpus — reproduces the two reported failures (intimate scene: characters go silent/repeat;
// the scene won't advance / defers back to the player) under CONTROLLED conditions. Same 10/5/5 shape as the
// broad corpus, so the guardrails compare like-for-like.
//
// Design choice that makes it a clean test: both partners are WILLING, forward, and talkative, and mutual
// desire is already established. So on the baited turns the correct behavior is OBVIOUS - they respond, the
// scene moves - and if the model instead goes silent or stalls ("are you sure / we don't have to"), that is the
// MODEL failing, not an authored reluctant trait. Content is consenting-adult and charged but non-graphic
// (intimacy-onset level, matching the tracked gate world).
//
// Baited `expect`:
//   { responders, mode:"direct"|"group" } — addressed partner(s) must speak (silence = the failure).
//   { advance: true }                      — the narration must MOVE, not stall/defer; a handback or "are you
//        sure / we don't have to / do you want" ending = the failure. May combine with responders.

export const WORLD =
  "A consenting-adult romance among three established partners. The player and both partners share an openly affectionate relationship; mutual desire is long established and the quiet evening in is turning intimate. Warm and tasteful, never graphic.";
export const PLAYER_TRAIT = "Alex, an adult in a loving, established relationship with both partners.";
export const LOCATION = "The partners' shared apartment - a couch in warm lamplight, the bedroom just down the hall.";
export const ENTITIES = [
  { name: "Mara", type: "Person", description: "AGE 30. A partner. Warm, forward, playful and talkative; openly desires the player and says so easily." },
  { name: "Sofia", type: "Person", description: "AGE 32. A partner. Affectionate, direct, and expressive; comfortable voicing what she wants." },
];

export const TURNS = [
  // ── 10 regular: build the charged context (guardrail — dialogue should stay present, no stalling) ──
  { action: "I settle onto the couch between Mara and Sofia, the three of us close in the low light.", present: ["Mara", "Sofia"] },
  { action: "I tell them how good it feels to finally have a quiet night in together.", present: ["Mara", "Sofia"] },
  { action: "I brush a strand of hair from Mara's face and hold her gaze.", present: ["Mara", "Sofia"] },
  { action: "I turn to Sofia and tell her I've been thinking about her all day.", present: ["Mara", "Sofia"] },
  { action: "I laugh as Mara teases me about being sentimental.", present: ["Mara", "Sofia"] },
  { action: "I lean into Sofia as she rests a hand on my knee.", present: ["Mara", "Sofia"] },
  { action: "I ask Mara what she's in the mood for tonight.", present: ["Mara", "Sofia"] },
  { action: "I trace a slow line along Sofia's arm with my fingertips.", present: ["Mara", "Sofia"] },
  { action: "I pull them both a little closer on the couch.", present: ["Mara", "Sofia"] },
  { action: "I meet Mara's eyes, the air between us turning warm and certain.", present: ["Mara", "Sofia"] },

  // ── 5 baited: the failure triggers, correct behavior obvious ──
  // advance: a decisive escalation — the scene should MOVE, not stall.
  { action: "I stand and take both their hands, drawing them up toward the bedroom.", present: ["Mara", "Sofia"], expect: { advance: true } },
  // direct: a pointed prompt to Mara — she must answer, in her own words.
  { action: "I turn to Mara and ask her to tell me exactly what she wants tonight.", present: ["Mara", "Sofia"], expect: { responders: ["Mara"], mode: "direct" } },
  // direct + advance: Sofia is asked to SAY something (a verbal prompt, not an action) AND the scene must move.
  { action: "I pull Sofia close and ask her to tell me she wants this as much as I do.", present: ["Mara", "Sofia"], expect: { responders: ["Sofia"], mode: "direct", advance: true } },
  // group: both addressed, breathless — at least two should speak.
  { action: "I ask them both, breathless, if this is everything they've been wanting too.", present: ["Mara", "Sofia"], expect: { responders: ["Mara", "Sofia"], mode: "group" } },
  // advance: another decisive step — no stalling back to me.
  { action: "I draw them both down with me, the night unmistakably turning.", present: ["Mara", "Sofia"], expect: { advance: true } },

  // ── 5 regular: continued, non-graphic, regression check ──
  { action: "I murmur how happy I am, tangled up close with them.", present: ["Mara", "Sofia"] },
  { action: "I press a slow kiss to Mara's shoulder.", present: ["Mara", "Sofia"] },
  { action: "I whisper something that makes Sofia laugh softly against me.", present: ["Mara", "Sofia"] },
  { action: "I settle back with the two of them warm against me.", present: ["Mara", "Sofia"] },
  { action: "I tell them both I'm not going anywhere tonight.", present: ["Mara", "Sofia"] },
];
