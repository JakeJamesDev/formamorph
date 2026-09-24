# 02: Live adapter in the game view

Status: ready-for-human
Base: 62982835
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

## Comments

**2026-09-24, rulings from the spec session (build):**

- **Persona helper kept.** Seven test files import `personaContextValues`, including the turn-plan parity test that must pass unedited and the preview pool test ticket 03 owns. The module's Persona family now calls it, so it has a production caller. The "deleted" criterion is dropped for that reason.
- **Lore in play.** The live scene carries no lore, and the game view drops the Dictionary family from the module's output before merging, the same pattern as the Notes and Time ruling. The narration prompt builder keeps activating lore per turn. Follow-up after 02–04: make lore optional in the scene so both caller-side drops go away.
- **Two additive scene fields, both optional.** `outerScopeEntities` is the roster the Sub-locations and Reachable scopes list; play passes the authored cast so a runtime character never appears in an outer scope. `inSceneNames` holds participant names that match nobody; they join the In Scene Name content only, after the ids. The authored and sample adapters leave both absent.
- **Override shape.** `sceneEntityChipValues(scene, sceneIds)` returns only the unscoped Entities tokens from the scene with `presentIds` replaced; scoped variants in the Choices prompt keep their base values. The override test moved into the module's suite with its registry-derived expectation.
- **In Scene Name spelling.** A matched participant renders as the entity's own name, no longer as the narration spelled it; the match ignores case and edge spaces, so only those can differ. This follows from the ids ruling and is accepted with the ordering nuance.
- **Hand-mirror test kept.** Only its six-line helper mirrored the builder; the eleven cases are the only integration coverage of persona rolls across turns, an undo, a switch, a save and reload, and a pin. The helper now renders through `chipValues` on a scene holding the live persona and resolve. The "deleted" criterion is amended for that reason.

**Live check (2026-09-24):** Veilwood, one real turn against a local Cydonia 24B. The narration request captured in the AI Context viewer and the Test Bench's AI Context instrument at The Drowned Hollow were compared byte for byte: Current Location (288 chars), Entities Here (1115 chars) and Entities Reachable (858 chars) all equal.
