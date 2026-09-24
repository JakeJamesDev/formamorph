# 02: Live adapter in the game view

Status: ready-for-agent
Blocked by: 01 — Chip Values module with the authored adapter
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Workload: surgery inside the largest view in the app, where the context builder, the before-box view override and the scene override are closures over dozens of state fields. Getting the Chip Scene built from the right sources, and from a before box in flight, needs careful reading of the turn flow. The parity tests and one live check are the safety net.

## Parent

[Spec: Chip Values](../spec.md)

## What to build

A player sends a turn and every chip in every request, and every run in the Request Anatomy, carries a value built by Chip Values from a Chip Scene the game view assembled. The live adapter is a hook beside the module. It builds a Chip Scene from the playthrough's contexts. When a stat-code before box is in flight, it builds a second scene from the box's writes instead of threading a view override through the builder.

The game view's own context builder and its scene override closure go. The Choices and re-roll prompts get their in-scene roster by calling the module with the in-scene ids substituted, so the override and the base values enumerate one set. The persona value helper loses its last caller and goes. The world's own placeholder-chip values keep their existing merge over the module's output, and the settings-derived guidance chips keep their existing path.

## Acceptance criteria

- [ ] A live adapter hook builds a Chip Scene from the playthrough, including the in-scene ids the Choices presence filter uses today
- [ ] A before box in flight yields a second Chip Scene built from its writes; no `view` parameter is threaded through a value builder
- [ ] The game view's context builder, its scene override closure, and the standalone scene-token function from the 2026-09-23 patch are deleted; the override test moves into the module's suite and keeps its registry-derived expectation
- [ ] The persona value helper is deleted along with its last caller
- [ ] The hand-mirror persona placeholders test is deleted; the behavior it checked is covered at the module's interface
- [ ] The world's placeholder-chip values still merge over the module's output for a world with custom prompts
- [ ] The turn plan and turn runner parity tests pass without edits
- [ ] Live check in the app, recorded in the ticket: enter a world, open the AI-context viewer, and confirm the Entities and Location chips carry the same text the Test Bench shows for that location
- [ ] Four gates green; `graphify update .` run; changelog entry under In Progress, 🛠️ Developer tooling, grouped with ticket 01's entry

## Blocked by

- 01 — Chip Values module with the authored adapter
