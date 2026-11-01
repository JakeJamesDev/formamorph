# 11: Mark the Custom Persona's Others Openings

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: new editor copy under the Writing Guide, the world openings view and the panel hint, all for one entity kind.

## What to build

The Custom Persona entity shows an Others/Self switch, but its Others openings never draw, and nothing says so. Ruling Q5: the switch stays. Each Others row on the Custom Persona carries a mark that it never draws. The world openings view drops its draw chance for those rows. The panel hint that says an entity's openings join at its locations is made true for the Custom Persona.

Spec: Q5, Implementation Decisions "Custom Persona openings". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [ ] An Openings panel test with an Others row on the Custom Persona fails today (no mark), then passes
- [ ] The world openings view shows no draw chance for those rows (pure test); a Self row keeps its chance
- [ ] The switch still shows on the Custom Persona (the existing switch test stays green)
- [ ] The mark and hint copy follow the Writing Guide (copy-sweep on the changed strings)
- [ ] World-Editor-Openings describes the mark; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤

For you: look at the mark on a Custom Persona Others opening in the World Editor.
