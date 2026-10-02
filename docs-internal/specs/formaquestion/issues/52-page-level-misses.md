# 52: Questions that never reach the page

Status: ready-for-agent
Blocked by: 50
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Player words reach the right page (Q79). In ticket 46, eight questions never reached the keyed page in 10 runs: `library-2` ("make its box bigger"), `personas-1`, `follow-default-make`, `entities-2`, `tools-2`, `world-editor-placeholders-2`, `worldformat-2`, `worldformat-3`.

- For each, find why neither the keyword search nor the AI pick reached the page.
- Fix the cause in the word map, the pick request or the docs. A word-map line must be a player word for that feature, written as ticket 43 did. Do not write lines from these eight questions' wording.
- A docs gap, where no section answers the question, is fixed in the docs page that owns the feature.
- Check every change on ticket 39's blind set.

**Probe.** Ticket 39's recall probe on both sets, shipped defaults, 5 runs. Ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: eight fixes that must generalize past the questions that found them.

## Acceptance criteria

- [ ] Each of the eight has a named cause in the handover: word map, pick, or docs gap
- [ ] No keyword line copies a known question's wording
- [ ] Blind-set recall@5 does not drop; same batch
- [ ] Probe numbers on all kinds, fixed vs current build, same batch, are in the handover
- [ ] Four gates green
