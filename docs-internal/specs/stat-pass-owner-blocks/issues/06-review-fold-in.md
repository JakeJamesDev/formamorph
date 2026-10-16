# 06: Review Fold-In

Status: done
Blocked by: 01, 02, 03, 04, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a review across five landed tickets against the spec and the repo standards, then the fixes it names.

Parent: [Stat Pass Owner Blocks spec](../spec.md)

## What to build

The closing review of tickets 01 to 05 against this spec, folded in as one unit. The review runs from the first ticket's base and reports on both axes: the repo's standards and this spec's rulings. Should-fix findings and nits land here with the tests the spec's Testing Decisions call for that no earlier ticket wrote.

Rulings: all.

## Acceptance criteria

- [ ] The review's should-fix findings are folded in or recorded as wontfix with a reason.
- [ ] Every test seam the spec names has a test that bites when its behavior is reverted.
- [ ] All four gates are green on main after the landing.

## Review

Run from `9cece1ffd` (the spec commit) over tickets 01 to 05, on both axes.

Folded in:

- The Chip values seam asked for a keyed cast entry with every Stat Detail piece. `keyedScene.test.ts` now renders the default prompt's In Scene block with range, descriptor and description, and goes red when the default drops the descriptor.
- `appliedWorldPrompt` in `worldPrompt.ts` holds the opt-out rule once. `resolveWorldPrompt` and GameViewer's fallback check both read it.
- One `StatText` type for the text pair a turn carries. `statTextFor` takes `{ worldPrompt }`, not a bare boolean.
- `createStatRequest` picks the persona and loose parts by owner key, not by slice position. A Stats chip that takes the persona's stats sends three owner tests red.
- The stale `playerTargets` comment now names the persona, loose and played targets.
- `World-Editor-Stats.md`: a world's own Stats prompt keeps the preset's fallback user message (Q32).

Wontfix:

- Rename `PLAYER_STAT_HEADING`. Its value is still the Player Character heading (Q8). A rename across the request, the tests and the probe adds churn and no clarity.
- Revert the `Persona-Authoring.md` edits. They keep that page consistent with the new blocks.
- Give `createStatRequest` role tags apart from the headings. The headings are the reply keys, so a part's heading is its role.
- Swap the new test's `split` for an assertion. A missing In Scene heading still fails the test, with a TypeError.

After the landing, on the main checkout (Q34): the fallback entry drops its "unprobed" sentence, and the owner-blocks entry moves from 🛠️ to 👤 Entity Stats. A ticket worktree can't edit the changelog.
