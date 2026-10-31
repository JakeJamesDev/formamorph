# 11: Read the Full Met Rule at Every Script Site

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Outside the live turn script and the opening fold, a script reads `met` as "has no Stranger Name". It skips relationships and Known In picks, so `met` can disagree with play in the Test Bench, a script Test Run and a Tool (Q77). Give those sites the played persona and the places, so `met` uses the same start-met rule as the Presence module.

## Acceptance criteria

- [ ] Every sandbox site that ships `met` reads it through the Presence module's start-met rule plus the met-in-play list.
- [ ] A test shows a stranger tied to the persona by a relationship reads `met: true` in a Test Run and in a Tool.
- [ ] The second met rule in `statCodeTraits.ts` is gone.
- [ ] Each test fails when its old behavior is put back.
