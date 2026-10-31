# 13: Build the Opening Persona in One Place

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Three callers build the opening persona for script `met` by hand: the Test Bench, the in-game Tool path in GameViewer, and the sample Tool snapshot. The Test Bench version handles world personas only, so a library persona picked in the Opening instrument reads `met` with no persona. One helper builds the persona from what the caller holds, library personas included (Q81). The trailing `persona?` arguments of the test-run and script-check functions fold into an options object.

## Acceptance criteria

- [x] One helper builds the opening persona, and all three callers use it. `openingPersonaOf` in `openingState.ts`; the Bench's Opening instrument fold uses it too.
- [x] A script reads `met: true` on a stranger tied by relationship to a library persona handed to the helper, in the Bench snapshot and in a Test Run (Q85: the Bench keeps its world-only picker). `statCodeTestRun.met.test.ts`, "a library persona".
- [x] The test-run and script-check functions take the persona in an options object, not as a trailing argument. `checkScripts`, `benchSnapshotOf`, `testCodeSnapshotOf`.
- [x] Each test fails when its old behavior is put back. Dropping the library entity in the helper turns three tests red.

## Landed

**Not verified**
- The in-game Tool caller in `GameViewer.tsx` and the sample Tool snapshot use the helper, but have no test of their own. The helper's tests cover the library case they depend on.

**For you**
- None.
