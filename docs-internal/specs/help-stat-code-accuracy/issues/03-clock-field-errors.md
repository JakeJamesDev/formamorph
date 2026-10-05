# 03: Clock Field Errors

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one new diagnostic in the analysis module with a clear precedent (unknown trait field); mostly tests.

## What to build

A player who types `clock.time` or `clock.previous.hour` in a stat's Code tab sees an error underline that says the field does not exist and suggests the closest real one. `clock.day`, `clock.daypart`, `clock.deltaHours`, `clock.elapsedHours`, `clock.previous.day` and `clock.previous.daypart` raise nothing. Test Code and the Test Bench report the same error.

## Acceptance criteria

- [ ] An unknown field after `clock.` or `clock.previous.` is an error with a "Did you mean" suggestion when one is close
- [ ] Every real clock field passes with no diagnostic
- [ ] Each test fails with the check removed
- [ ] Not run in parallel with 04; both edit the analysis module
- [ ] Changelog fragment written
