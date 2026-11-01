# 21: Group Rename Says Why It Refused

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one error line that reuses the picker's text and the shared check.

## What to build

A Group rename to a taken name snaps back to the old name with no message. Ruling Q17: the field shows the Group picker's error line, "A group already has this name." One source holds that string for both places.

Spec: Q17. Evidence: ticket 03, Landed.

## Acceptance criteria

- [x] A Library test that renames a Group to a taken name fails today (no message), then passes with the error line (`LibraryTileGrid.filter.test.tsx`, refused rename; no alert existed before)
- [x] The line clears on the next valid edit (same test: alert gone after typing)
- [x] The Library page says so; the docs tests are green (`npx vitest run docs`, 347 pass)
- [x] A changelog fragment under Minor / Fixed / 👤

## Landed

**Not verified**
- Bite check by reinstating the bug was not run; the alert assertion cannot pass without the new line.

**For you**
- Library, open a Group, rename it to another Group's name, press Enter: a red line shows under the field.
