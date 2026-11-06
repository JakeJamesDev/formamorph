# 01: Focus Classifier Probe

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it writes a new prompt for small models and judges probe numbers that decide whether the mode gets built.

## What to build

The first evidence that the Focus Classifier works and that trimmed narration holds up, before any pipeline work (Q12).

- Write the draft Focus Classifier prompt as a default prompt constant beside the other prompts, with no wiring into the game. This ticket owns the prompt text; ticket 02 wires it. Follow the prompt-writing guide: positive contract, no example values a small model can parrot. The user turn carries the player's action, the last narration, and one line per entity here and in sublocations: letter, name, and AI summary (full description when the summary is blank) (Q5, Q6, Q17). The reply is one line per letter with a tier word: Focus, Background or Offstage (Q21).
- Draft a labeled case file from bundled worlds and Sedge Landing: turns with 3 or more entities here, each with its expected tier per entity (Q14). Cover moves, addressed characters, entities named only by description, and sublocation entities.
- A harness script that sends each case to the classifier with `reasoning_effort: "none"` and the classifier's sampler pins, and reports Focus recall, tier match, parse failures and entity tokens saved.
- A second arm that sends narration with the full roster and with the hand-labeled trimmed roster for the same turns, and scores both on the continuity rubric.
- Run counts and in-batch controls follow the probe skill. Cloud default model first; the Cydonia arm runs only in a window the user agrees to.

## Acceptance criteria

- [ ] The draft prompt exists as a default prompt constant and nothing in the game reads it yet.
- [ ] The case file has the expected tier for every entity in every case.
- [ ] The user reviewed a sample of the labels before any counted run, and the ticket records their changes.
- [ ] The harness reports Focus recall, tier match, parse failures and tokens saved for each model.
- [ ] The narration arm reports continuity scores for full and trimmed rosters on the same turns.
- [ ] The ticket records the numbers for the cloud default model and Cydonia against the Q13 bar: Focus recall at least 95%, tier match at least 85%, trimmed narration no worse than full.
- [ ] The ticket lists every missed Focus entity with its case, so a later grill can decide on floors (Q9).

For you: review the label sample before the counted runs (the case file in this ticket's harness folder).
For you: pick a GPU window for the Cydonia arm.
For you: read three trimmed-vs-full narration pairs from the probe output and judge whether background characters still feel present.
