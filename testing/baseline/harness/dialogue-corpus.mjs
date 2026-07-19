// Authored dialogue-intent corpus — a designed 20-turn mini-session with KNOWN expected outputs, so the
// "addressed but silent" metric has a real oracle (unlike a replayed session, where single-speaker could be
// correct or wrong and the test can't tell). Sequential: context accumulates turn to turn, which is the
// failure trigger. Layout: 10 regular (build context + guardrail) → 5 baited (the metric) → 5 regular
// (regression). Broad average case, not edge cases: on every baited turn it is OBVIOUS who must speak.
//
// Baited turn `expect`:
//   { responders: [names], mode: "direct" }  — the player addresses these specific people (or says something
//        one clearly must react to). ALL of them must speak. An addressed single staying silent = HARD FAIL.
//   { responders: [names], mode: "group" }   — the player addresses the room. >=2 of the present cast must
//        speak (2/3 is a pass; 1 or 0 is a fail).
// Regular turns have no `expect` — they only feed the guardrails (dialogue/freeze/handback/length not degraded).

export const WORLD =
  "A warm, grounded modern-day housewarming dinner among friends. Easy conversation, good food, nothing sinister - people chat, catch up, and enjoy the evening.";
export const PLAYER_TRAIT = "Jordan, an easygoing adult friend of the host.";
export const LOCATION = "Nadia's new apartment - open living room and kitchen, a small dinner spread on the table.";
export const ENTITIES = [
  { name: "Nadia", type: "Person", description: "AGE 31. The host. Warm, chatty, genuinely delighted to have friends over; loves drawing people into conversation." },
  { name: "Theo", type: "Person", description: "AGE 34. A friendly, talkative software engineer; quick with a story and happy to hold the floor." },
  { name: "Priya", type: "Person", description: "AGE 29. A warm, thoughtful keen home cook; opens up readily when asked about food or her week." },
];

// present = who is physically in the scene by this turn (for the group-mode denominator and sanity).
export const TURNS = [
  // ── 10 regular: arrive, gather the cast, normal play ──
  { action: "I knock, step inside, and greet Nadia with a hug.", present: ["Nadia"] },
  { action: "I hand Nadia the bottle of wine I brought and ask how the new place is treating her.", present: ["Nadia"] },
  { action: "I follow Nadia into the living room where a couple of her friends are chatting.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I introduce myself to Theo and Priya.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I accept a glass of wine and settle into an open chair.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I ask Nadia how she and Theo first became friends.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I compliment Priya on the dish she brought to the table.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I take a bite and settle back, listening to the easy chatter around the table.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I glance at the framed photos on the shelf and ask Nadia about the one from the coast.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I refill my glass and take in the warm, lived-in room.", present: ["Nadia", "Theo", "Priya"] },

  // ── 5 baited: obvious dialogue demands ──
  // direct-single: a pointed question to one person — she MUST answer (hard fail if silent).
  { action: "I turn to Priya and ask her directly how she first got into cooking.", present: ["Nadia", "Theo", "Priya"], expect: { responders: ["Priya"], mode: "direct" } },
  // direct-dual: explicitly asks two people, wanting both sides.
  { action: "I ask Nadia and Theo to each tell me their version of how they met.", present: ["Nadia", "Theo", "Priya"], expect: { responders: ["Nadia", "Theo"], mode: "direct" } },
  // group: addresses the room — at least two should chime in.
  { action: "I raise my glass and ask the group what everyone's been up to this year.", present: ["Nadia", "Theo", "Priya"], expect: { responders: ["Nadia", "Theo", "Priya"], mode: "group" } },
  // direct-single: a statement one person clearly must react to.
  { action: "I tell Theo I really admired the talk he gave at the meetup last month.", present: ["Nadia", "Theo", "Priya"], expect: { responders: ["Theo"], mode: "direct" } },
  // direct-dual: asks two named people to weigh in on the same question.
  { action: "I ask Priya and Nadia to settle it - which place in town has the best food.", present: ["Nadia", "Theo", "Priya"], expect: { responders: ["Priya", "Nadia"], mode: "direct" } },

  // ── 5 regular: wind-down, regression check ──
  { action: "I laugh at Theo's joke and take another sip of wine.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I stand and help Nadia clear a few empty plates from the table.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I ask Priya if she'd like me to top off her glass.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I sink back onto the couch as the evening winds down.", present: ["Nadia", "Theo", "Priya"] },
  { action: "I thank Nadia for having us as people start to gather their things.", present: ["Nadia", "Theo", "Priya"] },
];
