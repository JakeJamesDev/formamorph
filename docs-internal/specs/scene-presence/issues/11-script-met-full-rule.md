# 11: Read the Full Met Rule at Every Script Site

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Outside the live turn script and the opening fold, a script reads `met` as "has no Stranger Name". It skips relationships and Known In picks, so `met` can disagree with play in the Test Bench, a script Test Run and a Tool (Q77). Give those sites the played persona and the places, so `met` uses the same start-met rule as the Presence module.

## Acceptance criteria

- [x] Every sandbox site that ships `met` reads it through the Presence module's start-met rule plus the met-in-play list. Callers that hold a persona pass it (Q80); the rest run the rule under null.
- [x] A test shows a stranger tied to the persona by a relationship reads `met: true` in a Test Run and in a Tool. `statCodeTestRun.met.test.ts`.
- [x] The second met rule in `statCodeTraits.ts` is gone. The absent-`metIds` branch calls `startsMet(entity, null, [])`.
- [x] Each test fails when its old behavior is put back. Ignoring the persona in the opening fold failed 3 of 5.

## Landed

**Not verified**
- The Test Bench wiring in `useTestBench.ts` (persona from the Opening instrument) and the in-game Tool fallback in `GameViewer.tsx` pass typecheck but have no test of their own.

**For you**
- Test Bench: pick a persona in the Opening instrument, run the script check, and confirm a script that reads `met` on a stranger tied to that persona sees `true`.
