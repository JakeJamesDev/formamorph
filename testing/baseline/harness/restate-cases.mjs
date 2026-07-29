// Ground truth for the restatement-diagnostic backtest (restate-backtest.mjs).
//
// Each DEFECT is a prompt state that a shipped fix later repaired, reconstructed from git as an exact
// reverse-edit of the current shipped text. `span` is the defective text itself — the detector "hits"
// only when the flag it emits quotes text overlapping that span, so scoring is mechanical, not judged.
//
// CONTROLS are the ledger surfaces marked KEEP (ablation-tested, verdict = no change needed). A flag
// overlapping one of those on the shipped arm is a false positive.
//
// Sources: dialogue-collapse ledger + commits 6304ec8, 74009af, 0cb2f64, 3dabde7, 863c7a9.
//
// Wrapper confound (measured, cloud v1): asked to "restate the prompt", the cloud model restated the
// ANALYST instructions instead of the narrator prompt on 50/50 runs. Mode `restate2` hardens the target
// reference to separate a real null from that artifact.

/** Reverse-edit: replace `from` with `to` in the given surface, throwing if `from` is absent (stale guard). */
export const edit = (surface, from, to) => ({ surface, from, to });

export const DEFECTS = [
  {
    id: "D1-fuse",
    fix: "Fix 1 — fuse edit (dialogue woven into physical action; ending favors a spoken line)",
    edits: [
      edit(
        "narration",
        "- Advance the scene, then stop, ending on a spoken line or concrete image that lands what this turn changed.\n- Characters speak through what they do: their actual words land as quoted dialogue woven into their movements, and the more physical the moment, the more they voice it - urging, teasing, voicing what they want next. Their words respond to what the player just said or did and carry the scene onward.",
        "- Advance the scene, then stop: your reply is complete once the events have been told, ending on a concrete image, action, or spoken line that lands what this turn changed.\n- When characters are present, they speak - render their actual spoken words as quoted dialogue, not a summary of what they say. Their words carry the scene onward - answering what the player just said or did, or speaking up on their own about what they want, notice, or feel.",
      ),
    ],
    span: "When characters are present, they speak - render their actual spoken words as quoted dialogue, not a summary of what they say. Their words carry the scene onward - answering what the player just said or did, or speaking up on their own about what they want, notice, or feel.",
    expected: "dialogue treated as a separate obligation from physical action; nothing ties speech to the movement or to the turn's ending",
  },
  {
    id: "D2-format-A",
    fix: 'Fix 2 — Format B (bare current-turn action, no "Player action:" wrapper)',
    edits: [{ surface: "narration-user", wrap: true }],
    span: "Player action:",
    expected: "the current turn is labeled differently from every prior turn in history (format mismatch)",
  },
  {
    id: "D3a-stats-preamble",
    fix: "Fix 3a — stats preamble cut",
    edits: [
      edit(
        "narration",
        "## Player Stats\n",
        "## Player Stats\nThese shape how each action goes - low stats cost, high stats come easy.\n",
      ),
    ],
    span: "These shape how each action goes - low stats cost, high stats come easy.",
    expected: "a second, looser statement of the stats rule that already exists in the Guidelines",
  },
  {
    id: "D3b-digest-tense",
    fix: "Fix 3b — present-tense digest voice",
    edits: [
      edit(
        "summary-user",
        "in one or two short second-person, present-tense sentences on a single line: what you do and what now stands true",
        "in one or two short second-person sentences on a single line: what you did and what now stands true",
      ),
    ],
    span: "single line: what you did",
    expected: "tense unspecified / past-tense example, conflicting with the present-tense story register",
  },
  {
    id: "D4-closing-voice",
    fix: "Fix 4 — voice clause added to the system closing contract",
    edits: [
      edit(
        "narration",
        ' or a bracketed stage direction like [Player\'s turn]. When the player\'s action speaks to a character, the reply on the page is that character\'s own voice: their quoted sentences, answering what was asked and adding something of their own. The player\'s words are already spoken by the player - yours to write is the world\'s answer.',
        " or a bracketed stage direction like [Player's turn].",
      ),
    ],
    span: 'Output only the story prose - the events themselves, with no labels, no mention of being an AI, and nothing after the scene ends. The choices step that follows you handles the player\'s options, so your reply never contains a question to the player, a list of actions, a "Choose"/"Options" menu, or a bracketed stage direction like [Player\'s turn].',
    expected: "the closing contract is all prohibitions and says nothing about what the reply to a spoken action must contain",
  },
  {
    id: "D5-asking",
    fix: "Fix 5 — ask→voicing swap (removed the prompt's own permission license)",
    edits: [edit("narration", "voicing what they want next", "asking for what they want next")],
    span: "urging, teasing, asking for what they want next",
    expected: "the prompt licenses characters to ask for things rather than say them — turns dialogue into questions back at the player",
  },
  {
    id: "D6-vague-combo",
    fix: "Fix 6 — vague-line combo (concrete continuity rule; deleted the 'events have been told' clause)",
    edits: [
      edit(
        "narration",
        "- What the story has established stays true: where everyone is, what they hold and wear, and what has been said or done carry into this turn unless the action changes them.",
        "- Stay consistent with the world, traits, location, and the story so far.",
      ),
      edit(
        "narration",
        "- Advance the scene, then stop, ending on",
        "- Advance the scene, then stop: your reply is complete once the events have been told, ending on",
      ),
    ],
    span: "- Stay consistent with the world, traits, location, and the story so far.\n|your reply is complete once the events have been told",
    expected: "unactionably vague instructions — 'stay consistent' names nothing to carry, and 'once the events have been told' is a self-judged completion license",
  },
  {
    id: "D7-user-voice",
    fix: "Fix 7 — voice clause in the user slot (biggest lever measured)",
    edits: [{ surface: "narration-user", stripVoice: true }],
    span: "<USER-MESSAGE-IS-BARE-ACTION>",
    expected: "the highest-recency message carries no instruction at all — only the raw action",
    bareUserArm: true,
  },
];

// Ledger surfaces with verdict KEEP / evidence-closed. Flags overlapping these on the shipped arm are
// false positives: each was ablation-tested and the removal measured worse.
export const CONTROL_SPANS = [
  {
    id: "identity-paragraph",
    span: "You are the narrator stage of an interactive story. Your one job is to write the story: vivid second-person prose describing what happens in response to the player's most recent action - or the opening scene, if the story is just beginning. Immediately after you, a separate step presents the player's choices, so offering options is never your job.",
  },
  { id: "tense-bullet", span: '- Write in second person, present tense ("You ...").' },
  {
    id: "continuity-rule",
    span: "- What the story has established stays true: where everyone is, what they hold and wear, and what has been said or done carry into this turn unless the action changes them.",
  },
  {
    id: "stats-bullet",
    span: "- Let the player's current stats shape how each action turns out: a low stat shows in the effort it costs, a high one shows as ease or assurance - worked into the events, not stated.",
  },
  { id: "stat-negative", span: "- Don't report or tabulate the player's stats or their changes - a separate step handles them." },
  {
    id: "name-withholding",
    span: "- The names in your notes are what you know, not what the player knows: introduce anyone the player hasn't met by description - what they look like, their role, what they are doing - and let a name reach the page only once the player would have learned it in the story.",
  },
  {
    id: "ending-contract",
    span: "- Advance the scene, then stop, ending on a spoken line or concrete image that lands what this turn changed.",
  },
  { id: "length-guidance", span: "- Be concise and vivid. Write at most 6 short paragraphs." },
  {
    id: "closing-contract",
    span: 'Output only the story prose - the events themselves, with no labels, no mention of being an AI, and nothing after the scene ends. The choices step that follows you handles the player\'s options, so your reply never contains a question to the player, a list of actions, a "Choose"/"Options" menu, or a bracketed stage direction like [Player\'s turn].',
  },
];
