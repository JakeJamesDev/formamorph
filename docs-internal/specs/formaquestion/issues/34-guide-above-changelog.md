# 34: Guide sections above the changelog

Status: ready-for-agent
Blocked by: 26
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A how-to question gets guide sections, and a "what's new" question gets the changelog (Q60). In ticket 26, released changelog sections ranked first for task questions: "change the Profile Image" got Morph art lines, and "add a library entity to a game" got changelog lines with developer names in them. Both "what's new" questions got no changelog section at all.

- Guide sections rank above released changelog sections for the same match.
- A question about what is new, changed or fixed still finds the changelog sections, newest first.
- The Search tab and the help session use the same ranking.

**Probe.** Run ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report grounded-correct and right-source per kind, and the changelog questions' sources.

Recommended model rationale: ranking changes move every question, so the probe read matters.

## Acceptance criteria

- [ ] For a task question that matches both, a guide section ranks above a changelog section; a test asserts it
- [ ] A "what's new" question sends changelog sections; a test asserts it
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover; no kind drops by more than the 5-point batch drift
- [ ] Four gates green
