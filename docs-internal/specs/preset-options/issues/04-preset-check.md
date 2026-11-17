# 04: Preset Check

Status: ready-for-agent
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
- **Editor.** The Options tab shows the check's results as a warning on the Preset value, and names each failing row.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md). Write a changelog fragment.

## Acceptance criteria

- [ ] The check reports each case in the list above. Each test fails when its branch of the check is removed.
- [ ] A value whose rows all apply reports nothing.
- [ ] The Options tab shows a warning on a failing value and names the row.
- [ ] Frame: `.scratch/frames/preset-warning-light.png` at desktop width.
