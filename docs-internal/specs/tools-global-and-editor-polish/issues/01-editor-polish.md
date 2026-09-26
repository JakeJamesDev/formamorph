# 01: Editor Polish: Offered To Multi-Select, Drop Enabled, Full-Screen Try It

Status: ready-for-human
Base: 081778f5
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: contained UI work on one editor and one shared component, with existing jsdom tests as prior art.

## What to build

In the Tool editor, the player picks the prompts a Tool is offered to from the same multi-select the World Editor uses for entities. The dropdown shows a Select All row. Checking every prompt shows one chip that reads "All prompts" instead of a chip per prompt. Select All clears the list when every prompt is checked. The editor no longer shows an Enabled checkbox; the list row switch stays the only place that bit changes, and saving an edit leaves the bit as it was. In full screen the Try It panel takes one third of the width with the current minimum kept. The docked layout is unchanged.

## Acceptance criteria

- [ ] The shared multi-select accepts an `allSelectedLabel` prop and shows that label as one chip when every option is selected
- [ ] Offered To renders the multi-select with Select All visible, "All prompts" as the label, and the request-kind order the editor uses today
- [ ] The editor renders no Enabled checkbox; saving an edit does not change the Tool's enabled bit
- [ ] The full-screen editor grid gives Try It one third of the width with a 22rem floor; the docked grid keeps its fixed track
- [ ] Tests at the ToolsTab harness cover Select All, the "All prompts" chip, the absent checkbox, and the full-screen track; each fails when its behavior is removed
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
