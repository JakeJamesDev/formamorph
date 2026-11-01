# 06: Enter World for a Custom-Persona-Only World

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: an unverified bug, so the ticket first reproduces it in a new component test of Enter World, then fixes the caller mapping.

## What to build

A world whose only persona choice is the Custom Persona, with no traits, one starting location and no library additions, may skip **Enter World**. The player then never sees the **Name** and **Description** fields. The bug was read in source, not run. Reproduce it first in a component test of Enter World. If the dialog does open, stop and report to the spec session. Otherwise the enter-flow input gains a Custom Persona flag, so that world opens the persona step.

Spec: Implementation Decisions "Enter World". Evidence: docs-sweep ticket 05, Landed.

## Acceptance criteria

- [ ] A component test of Enter World with that world fails today (the game starts with no persona step), then passes with **Name** offered
- [ ] A pure enter-flow test covers the Custom Persona flag beside the existing persona case
- [ ] A world with nothing to choose and no Custom Persona still skips the dialog (test)
- [ ] Starting-a-Game and Personas describe the Custom Persona case as the fix makes it; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
