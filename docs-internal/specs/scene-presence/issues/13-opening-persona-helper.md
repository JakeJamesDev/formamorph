# 13: Build the Opening Persona in One Place

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Three callers build the opening persona for script `met` by hand: the Test Bench, the in-game Tool path in GameViewer, and the sample Tool snapshot. The Test Bench version handles world personas only, so a library persona picked in the Opening instrument reads `met` with no persona. One helper builds the persona from what the caller holds, library personas included (Q81). The trailing `persona?` arguments of the test-run and script-check functions fold into an options object.

## Acceptance criteria

- [ ] One helper builds the opening persona, and all three callers use it.
- [ ] In the Test Bench, a script reads `met: true` on a stranger tied by relationship to a library persona picked in the Opening instrument.
- [ ] The test-run and script-check functions take the persona in an options object, not as a trailing argument.
- [ ] Each test fails when its old behavior is put back.
