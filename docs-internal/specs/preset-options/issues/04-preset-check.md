# 04: Preset Check

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The editor flags a Preset value that cannot fully apply, so the author finds it before a player does. The spec covers this in Q8 and in its Preset check decision.

- **Check.** Add a pure check. For each Preset value, it reports the rows that fail in that value's own target state, and the rows whose target no longer exists. The target state is the defaults plus the rows, for both snapshot and overlay. It catches:
  - self-contradicting rows
  - rows that over-fill a group's Pick Count
  - rows for a trait whose Mode stops the player toggling it, such as Automatic
  - rows that name a deleted trait, Option, location or persona
  - rows whose target apply would skip (Q24, Q28, Q35, Q36): a hidden or Preset Option, an owner not in the default cast, a persona that is no longer a persona or not in Allowed Personas, and a location that the Starting Location step would not offer
- Reuse apply's own skip result where you can, so the check and the setup screen never disagree.
- **Editor.** The Options tab shows the check's results as a warning on the Preset value, and names each failing row.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md). Write a changelog fragment.

## Acceptance criteria

- [x] The check reports each case in the list above. Each test fails when its branch of the check is removed. `presetCheck.test.ts`; 13 mutations (the check's own guards and apply's skip guards) each turned a test red. The Allowed Personas case is unreachable: it limits only library personas, which rows never name.
- [x] A value whose rows all apply reports nothing. `presetCheck.test.ts` "reports nothing for a value whose rows all apply, or that has no rows".
- [x] The Options tab shows a warning on a failing value and names the row. `WorldEditor.presetOption.test.tsx` "warns on a value with rows that can't apply"; wording per Q40 as revised (row names, deleted rows counted).
- [x] Frame: `.scratch/frames/preset-warning-light.png` at desktop width. 1440 px, light theme.

## Landed

**Not verified**
- None.

**For you**
- The warning text in light theme: the yellow warning token reads faintly on the near-white card. It is the existing `text-warning` pattern (see `.scratch/preset-options-04/frames/preset-warning-light.png`).
