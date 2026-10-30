# 06: Unidentified Name Leak Probe

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Measurement only. The user rules the ceiling from its numbers (Q24).

## What to build

A probe that measures how often the narrator names an unidentified item's true face before a reveal. It runs narration turns that show the item without revealing it, with an in-batch control where Items Here holds only the unidentified face. It reports the leak rate per arm.

Spec: Testing Decisions (Probes); Q14, Q24.

## Acceptance criteria

- [ ] A probe CLI under the baseline harness runs narration turns over a fixture with an unidentified item and scores true-face mentions
- [ ] Two arms, paired by run index: both faces (as shipped) and the unidentified face only (control)
- [ ] Cloud, 12 runs per arm per case; the leak rate per arm goes in the landing for the user's ruling
- [ ] The developer tooling changelog names the probe

## Blocked by

- 03
