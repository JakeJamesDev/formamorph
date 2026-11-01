# 06: Enter World for a Custom-Persona-Only World

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: an unverified bug, so the ticket first reproduces it in a new component test of Enter World, then fixes the caller mapping.

## What to build

A world whose only persona choice is the Custom Persona, with no traits, one starting location and no library additions, may skip **Enter World**. The player then never sees the **Name** and **Description** fields. The bug was read in source, not run. Reproduce it first in a component test of Enter World. If the dialog does open, stop and report to the spec session. Otherwise the enter-flow input gains a Custom Persona flag, so that world opens the persona step.

Spec: Implementation Decisions "Enter World". Evidence: docs-sweep ticket 05, Landed.

## Acceptance criteria

- [x] A component test of Enter World with that world fails today (the game starts with no persona step), then passes with **Name** offered: `MainMenu.entry` "opens the dialog for a Custom Persona"; red run saw `onStartGame` get `{ ref: { source: 'none' } }`; a live preview with an empty library shows the Name field
- [x] A pure enter-flow test covers the Custom Persona flag beside the existing persona case: `enterFlow.test` "shows the workspace for a Custom Persona alone"; bites on removing the rule's clause
- [x] A world with nothing to choose and no Custom Persona still skips the dialog (test): `MainMenu.entry` "skips the dialog with no Custom Persona", `enterFlow.test` "shows no step"; bites on a caller that always sets the flag
- [x] Starting-a-Game and Personas describe the Custom Persona case as the fix makes it; the docs tests are green: `src/lib/docs` green
- [x] A changelog fragment under Minor / Fixed / 👤: `docs-internal/changelog.d/docs-sweep-bugs-06.md`

## Landed

**Not verified:** nothing.

**For you:** nothing only a player can judge.
