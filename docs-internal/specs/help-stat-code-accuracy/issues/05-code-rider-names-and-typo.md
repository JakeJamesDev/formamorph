# 05: Code Rider Names And Typo

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a two-line prompt edit with an existing rider test; the probe decision belongs to 07.

## What to build

The Code rider reads correctly: the missing space after "sentence:" is fixed, and the object line names `entities` and `persona` as bare names beside `traits`. The rule that the rider names no members stays. The names are kept only if ticket 07's rider arm shows a gain; this ticket lands them so 07 can measure them.

## Acceptance criteria

- [ ] The rider text has a space after "sentence:"
- [ ] The object line names `self`, `stats`, `traits`, `entities`, `persona`, `placeholders` and `clock`, with no member names
- [ ] The existing rider tests pass, updated for the new line
- [ ] Changelog fragment written
