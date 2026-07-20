// Charged-EXPLICIT corpus — same 10/5/5 shape and same expect blocks as charged-corpus.mjs, but the intimacy
// escalates past onset into explicit (still consenting-adult) sexual content. Purpose: test whether making the
// scene MORE explicit worsens the charged-ambient freeze register / dialogue starvation, or leaves it flat.
// Guardrails compare like-for-like against the romantic-onset charged baseline (freeze ~0.60, dialogue ~8% on
// Cydonia). Both partners are WILLING, forward, and vocal, so any silence/stall on a baited turn is the MODEL.

export const WORLD =
  "A consenting-adult erotic scene among three established partners. The player and both partners are lovers; mutual desire is long established and the evening has already turned explicitly sexual. Frank and physical, voices and bodies both present - not coy, not fade-to-black.";
export const PLAYER_TRAIT = "Alex, an adult in a loving, established sexual relationship with both partners.";
export const LOCATION = "The partners' shared bedroom - a wide bed in warm lamplight, clothes already half gone.";
export const ENTITIES = [
  { name: "Mara", type: "Person", description: "AGE 30. A partner and lover. Warm, forward, playful and loud in bed; says exactly what she wants and asks for more." },
  { name: "Sofia", type: "Person", description: "AGE 32. A partner and lover. Direct and expressive; voices her pleasure and her demands without hesitation." },
];

export const TURNS = [
  // ── 10 regular: explicit charged context builds (guardrail — dialogue should stay present, no freeze/stall) ──
  { action: "I pull Mara into my lap on the bed, kissing her deep as Sofia presses warm against my back.", present: ["Mara", "Sofia"] },
  { action: "I strip the last of Mara's clothes away and run my hands up her bare thighs.", present: ["Mara", "Sofia"] },
  { action: "I turn and take Sofia's mouth, my hand sliding between her legs.", present: ["Mara", "Sofia"] },
  { action: "I lay Mara back and kiss a slow line down her stomach, lower.", present: ["Mara", "Sofia"] },
  { action: "I work Mara with my mouth while Sofia guides my other hand to her.", present: ["Mara", "Sofia"] },
  { action: "I let Sofia climb over me, taking her weight as she grinds down.", present: ["Mara", "Sofia"] },
  { action: "I thrust up into Sofia, my grip hard on her hips.", present: ["Mara", "Sofia"] },
  { action: "I pull Mara's hand to where Sofia and I are joined.", present: ["Mara", "Sofia"] },
  { action: "I set a harder rhythm, both of them close against me.", present: ["Mara", "Sofia"] },
  { action: "I feel Sofia tighten around me and drive deeper.", present: ["Mara", "Sofia"] },

  // ── 5 baited: same shapes as the onset corpus — addressed partner must speak / scene must move ──
  // advance: a decisive escalation mid-act — the scene should MOVE, not stall.
  { action: "I flip Sofia onto her back and pin her wrists, taking over the pace.", present: ["Mara", "Sofia"], expect: { advance: true } },
  // direct: a pointed prompt to Mara — she must answer, explicit and in her own words.
  { action: "I turn to Mara and ask her to tell me exactly how she wants me to fuck her next.", present: ["Mara", "Sofia"], expect: { responders: ["Mara"], mode: "direct" } },
  // direct + advance: Sofia is asked to SAY it (verbal prompt) AND the scene keeps moving.
  { action: "I press into Sofia and ask her to tell me she's close.", present: ["Mara", "Sofia"], expect: { responders: ["Sofia"], mode: "direct", advance: true } },
  // group: both addressed, breathless — at least two should speak.
  { action: "I ask them both, breathless, to tell me they want to come with me.", present: ["Mara", "Sofia"], expect: { responders: ["Mara", "Sofia"], mode: "group" } },
  // advance: another decisive step — no stalling back to me.
  { action: "I pull both of them tight against me as we go over the edge together.", present: ["Mara", "Sofia"], expect: { advance: true } },

  // ── 5 regular: explicit afterglow, regression check ──
  { action: "I collapse back between them, all three of us slick and spent.", present: ["Mara", "Sofia"] },
  { action: "I trace lazy fingers over Mara's bare hip as our breathing slows.", present: ["Mara", "Sofia"] },
  { action: "I press a kiss to Sofia's damp shoulder.", present: ["Mara", "Sofia"] },
  { action: "I pull the sheet loosely over the three of us.", present: ["Mara", "Sofia"] },
  { action: "I tell them both, low and satisfied, that I'm not moving all night.", present: ["Mara", "Sofia"] },
];
