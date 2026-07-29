// Narration-prompt arm definitions for the rider ablation — plus the shared prompt fills the long-session
// probes use, so the freezer and the probe assemble byte-identical prompts.
//
// The `stripped` arm reproduces a REAL user session (testing/real-sessions/session.json, 2026-07-29) in
// which the narration prompt had been cut back to its two base Guidelines bullets: the role intro's job
// description, seven behavioral riders, the closing output contract, and the user-slot voice rider were all
// absent. That session showed no more echo/re-ask than shipped-prompt sessions, which is what this probe
// exists to confirm or refute at depth.
//
// Every edit asserts its target exists, so a GamePrompts.ts wording change fails the run loudly instead of
// silently no-op'ing into a null test.

/** The role intro's job description — the part the stripped session lacked (first sentence stays). */
export const INTRO_TAIL =
  " Your one job is to write the story: vivid second-person prose describing what happens in response to the player's most recent action - or the opening scene, if the story is just beginning. Immediately after you, a separate step presents the player's choices, so offering options is never your job.";

/** The behavioral riders, each keyed for leave-one-out. The two base bullets (voice/tense and length) and
 *  the Formatting block are NOT riders — they were present in the stripped session. */
export const RIDERS = {
  continuity:
    "- What the story has established stays true: where everyone is, what they hold and wear, and what has been said or done carry into this turn unless the action changes them.\n",
  brackets:
    "- Square-bracketed text in the player's action is the author directing the scene, not something the character says or does: make this turn go the way it directs, and keep the story's prose free of it.\n",
  stats:
    "- Let the player's current stats shape how each action turns out: a low stat shows in the effort it costs, a high one shows as ease or assurance - worked into the events, not stated.\n",
  advance:
    "- Advance the scene, then stop, ending on a spoken line or concrete image that lands what this turn changed.\n",
  speech:
    "- Characters speak through what they do: their actual words land as quoted dialogue woven into their movements, and the more physical the moment, the more they voice it - urging, teasing, voicing what they want next. Their words respond to what the player just said or did and carry the scene onward.\n",
  names:
    "- The names in your notes are what you know, not what the player knows: introduce anyone the player hasn't met by description - what they look like, their role, what they are doing - and let a name reach the page only once the player would have learned it in the story.\n",
  pcFeatures:
    "- The player's own fixed features - their appearance, name, and role - are already established; don't re-introduce or re-describe them each turn. Reach for one only when the moment genuinely turns on it, never as scene-setting.\n",
  noTabulate:
    "- Don't report or tabulate the player's stats or their changes - a separate step handles them.\n",
};

/** The user-slot voice rider (defaultNarrationUserPrompt's tail), absent in the stripped session. */
export const VOICE_RIDER =
  "When the player's action speaks to a character, the reply on the page is that character's own voice: their quoted sentences, answering what was asked and adding something of their own. The player's words are already spoken by the player - yours to write is the world's answer.";

const CONTRACT_HEAD = "\n\nOutput only the story prose";

function cut(text, find, label) {
  if (!text.includes(find)) throw new Error(`[${label}] not found in the narration prompt (GamePrompts.ts drifted?):\n${find.slice(0, 90)}`);
  return text.replace(find, "");
}

/**
 * Apply an arm to the raw narration system prompt.
 * `shipped` returns it untouched; `stripped` reproduces the real session; `drop:<rider>` removes one rider.
 * Returns the prompt text plus whether the user-slot voice rider rides this arm.
 */
export function applyArm(sys, arm) {
  if (arm === "shipped") return { sys, voiceRider: true };
  if (arm.startsWith("drop:")) {
    const key = arm.slice(5);
    if (!RIDERS[key]) throw new Error(`unknown rider "${key}" (have: ${Object.keys(RIDERS).join(", ")})`);
    return { sys: cut(sys, RIDERS[key], key), voiceRider: true };
  }
  if (arm !== "stripped") throw new Error(`unknown arm "${arm}" (shipped | stripped | drop:<rider>)`);
  let out = cut(sys, INTRO_TAIL, "intro");
  for (const [key, text] of Object.entries(RIDERS)) out = cut(out, text, key);
  const at = out.indexOf(CONTRACT_HEAD);
  if (at < 0) throw new Error("[contract] closing output contract not found in the narration prompt");
  return { sys: out.slice(0, at), voiceRider: false };
}

// ── Proposed levers (2026-07-29), tested before they touch GamePrompts.ts ────────────────────────────
// L1 makes the player's action the turn's first beat, voiced: the shipped wording tells the model the
// player's words are already spoken, so a vague speech action ("I tell him what I think") comes back as
// the NPC restating it. The NPC-answers half of the clause is the measured 3x participation lever and is
// kept verbatim. L2 gives the narrator the adjudication job the planner already hands it. BRACKET lets
// authorial direction outrank L2, so an impossible action still happens when the author asks for it.

/** The pre-L1 voice rider, kept as the revert arm (`l1off`) so the win stays re-measurable. */
export const VOICE_LEGACY =
  "When the player's action speaks to a character, the reply on the page is that character's own voice: their quoted sentences, answering what was asked and adding something of their own. The player's words are already spoken by the player - yours to write is the world's answer.";

/** L1 first draft — superseded by VOICE_TIGHT1; kept as the `l1b` arm. */
export const VOICE_FIRSTBEAT =
  "The player's action is the turn's first beat: put it on the page as it happens - when it speaks, give the player the actual words, carrying the feeling the action names, and let the character answer in their own quoted voice with something of their own.";

// SHIPPED. The first draft left a paraphrase loophole: "give the player the actual words" is satisfied by
// a restatement ("You tell Bram exactly what you think of his ferry.") with nobody quoted. Naming quoted
// sentences as the shape closed it (cloud 31→67% player speech at 36 runs/arm, no NPC cost). Saying it
// outright instead - "in quotation marks", VOICE_TIGHT2 - measured WORSE than the draft on both models.
export const VOICE_TIGHT1 =
  "The player's action is the turn's first beat, written as it happens - an action that speaks reaches the page as the player's own quoted sentences, carrying the feeling the action names, and then the character answers in their own quoted voice with something of their own.";
export const VOICE_TIGHT2 =
  "The player's action is the turn's first beat: you write what it looks and sounds like. When the action speaks, you supply the words themselves in quotation marks, in the voice and temper the action names, and the character answers in their own quoted voice with something of their own.";

/** L2 first attempt — "attempt + reach" as a Guidelines bullet. Measured null; kept as the `l2` arm. */
export const ADJUDICATE =
  "- The player's action is what they attempt, and the world answers with what actually follows from it - an attempt beyond what this place allows still happens, and lands as the world would have it land.\n";

// L2 round 2 isolates SLOT, not wording: one sentence in three positions. The round-1 bullet sat mid-list
// among nine others, while L1 - the lever that works - rides the per-turn user message. If placement is
// why L2 measured null, the same text in the recency slot moves and the bullet stays flat.
export const ADJUDICATE_2 =
  "The player chooses what to attempt; what comes of it is the world's answer - give the attempt what this place and this body can actually deliver, and let the people present respond to what they saw.";

const BRACKET_SHIPPED_TAIL = "make this turn go the way it directs, and keep the story's prose free of it.";
const BRACKET_LEVER_TAIL = "make this turn go the way it directs, whatever the world would otherwise allow, and keep the story's prose free of it.";

function swap(text, find, replace, label) {
  if (!text.includes(find)) throw new Error(`[${label}] edit target not found (GamePrompts.ts drifted?):\n${find.slice(0, 90)}`);
  return text.replace(find, replace);
}

const ARMS = [
  "shipped", "l1off", "l1b", "l1t2",           // L1: revert / first draft / rejected wording
  "l1sysonly", "l1useronly",                   // L1: is the duplication load-bearing?
  "l2", "l2bullet", "l2contract", "l2user",    // L2: round-1 bullet, then one sentence in three slots
  "bracket", "all",
];

/**
 * Apply a lever arm to the narration system prompt, the per-turn user rider, and the OOC bracket rider.
 * The L2 slot arms carry identical text so a difference between them is placement, not wording.
 */
export function applyLevers(arm, { sys, userRider, oocRider }) {
  const on = (k) => arm === "all" || arm === k;
  // VOICE_TIGHT1 ships, so every voice arm swaps it out: `l1off` reverts to pre-L1, `l1b` to the first
  // draft, `l1t2` to the rejected quotation-marks wording.
  const VOICE_ARMS = { l1off: VOICE_LEGACY, l1b: VOICE_FIRSTBEAT, l1t2: VOICE_TIGHT2 };
  if (!ARMS.includes(arm)) throw new Error(`unknown lever arm "${arm}" (${ARMS.join(" | ")})`);
  let s = sys, u = userRider, o = oocRider;
  if (VOICE_ARMS[arm]) {
    s = swap(s, VOICE_TIGHT1, VOICE_ARMS[arm], `${arm}/system`);
    u = swap(u, VOICE_TIGHT1, VOICE_ARMS[arm], `${arm}/user`);
  }
  // L1 ships in both slots. These drop one copy each, to find out whether the duplication earns itself.
  // NOTE: the user rider is thinking-off only, so `l1useronly` is what the thinking modes already get.
  if (arm === "l1sysonly") u = swap(u, `\n\n${VOICE_TIGHT1}`, "", "l1sysonly/user");
  if (arm === "l1useronly") s = swap(s, ` ${VOICE_TIGHT1}`, "", "l1useronly/system");
  if (on("l2")) {
    s = swap(s, RIDERS.noTabulate, RIDERS.noTabulate + ADJUDICATE, "l2/guidelines");
  }
  // Same sentence, three slots — the round-2 placement test.
  if (arm === "l2bullet") s = swap(s, RIDERS.noTabulate, `${RIDERS.noTabulate}- ${ADJUDICATE_2}\n`, "l2bullet");
  if (arm === "l2contract") s = `${s} ${ADJUDICATE_2}`;
  if (arm === "l2user") u = `${u}\n\n${ADJUDICATE_2}`;
  if (on("bracket")) {
    s = swap(s, BRACKET_SHIPPED_TAIL, BRACKET_LEVER_TAIL, "bracket/system");
    o = swap(o, BRACKET_SHIPPED_TAIL, BRACKET_LEVER_TAIL, "bracket/ooc");
  }
  return { sys: s, userRider: u, oocRider: o };
}

// Used when a caller doesn't pass the live MARKDOWN_ON block from GamePrompts.ts.
const MARKDOWN_FALLBACK = `## Formatting
- Write immersive, flowing prose - never a list, menu, or table.`;

const entitiesMd = (entities) =>
  entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n");

/** Fill the narration system prompt from a corpus module (world, playerTrait, location, entities). */
export function renderNarrationSys(sys, c, { length = "Write at most 6 short paragraphs.", markdown } = {}) {
  return sys
    .replaceAll("<LENGTH GUIDANCE>", length)
    .replaceAll("<MARKDOWN GUIDANCE>", markdown ?? MARKDOWN_FALLBACK)
    .replaceAll("<WORLD DESCRIPTION>", c.WORLD)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "N/A")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${c.PLAYER_TRAIT}`)
    .replaceAll("<NOTES>", "N/A")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${c.LOCATION}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", entitiesMd(c.ENTITIES))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");
}

/** Fill the choices system prompt from the same corpus module. */
export function renderChoicesSys(sys, c) {
  return sys
    .replaceAll("<WORLD DESCRIPTION>", c.WORLD)
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "N/A")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${c.PLAYER_TRAIT}`)
    .replaceAll("<NOTES>", "N/A")
    .replaceAll("<LOCATION|summary.markdown>", `- **name:** ${c.LOCATION}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|summary.markdown>", entitiesMd(c.ENTITIES))
    .replaceAll("<ENTITIES|sublocations.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A");
}
