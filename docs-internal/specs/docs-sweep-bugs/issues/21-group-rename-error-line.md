# 21: Group Rename Says Why It Refused

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one error line that reuses the picker's text and the shared check.

## What to build

A Group rename to a taken name snaps back to the old name with no message. Ruling Q17: the field shows the Group picker's error line, "A group already has this name." One source holds that string for both places.

Spec: Q17. Evidence: ticket 03, Landed.

## Acceptance criteria

- [ ] A Library test that renames a Group to a taken name fails today (no message), then passes with the error line
- [ ] The line clears on the next valid edit (test)
- [ ] The Library page says so; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
