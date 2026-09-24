# 01: Chip Values module with the authored adapter

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Workload: this ticket sets the module's shape and the registry-driven enumeration every later ticket reuses. It reads the whole prompt registry, two builders that share a shape but differ in details, and the tests of two editor surfaces that must pass unchanged. The design calls are the hard part, not the volume.

## Parent

[Spec: Chip Values](../spec.md)

## What to build

An author opens the World Editor's Preview tab or the Test Bench's Opening instrument and sees every chip value rendered exactly as before, but the values now come from one module. **Chip Values** takes a **Chip Scene**, a plain value describing one moment, and returns a value for every scene-derived chip token the registry defines: World Description, Stats, Traits, Persona, Location, Entities, Notes, Time, and the lore blocks. It walks the registry's axes for each family, so a new axis option gets a value without a caller changing.

The module lives in its own folder beside the AI request module. An authored adapter beside it builds a Chip Scene from an authored world plus the preview options the Opening instrument passes today: active traits, settled stats, a chosen location, a fixed resolve. The editor's preview builder is replaced by that adapter plus the module, and its two callers switch over.

Two prefactors land inside this ticket. The scoped-token expander reads its content and format ids from the registry's axes instead of re-typing them. The Stats enumeration reads pieces and format from the decoded variant once, inside the module. The scene override added by the 2026-09-23 patch is not moved yet; that is ticket 02.

## Acceptance criteria

- [ ] A Chip Scene type exists as a plain value with the fields the spec lists: overview text, player stats, traits in force with groups, persona or none, current location or none, all locations and connections, roster, present ids, in-scene ids, lore entries with positions, notes, time or none, and a resolve function
- [ ] `chipValues(scene)` returns a value for every token and variant the registry defines for the scene-derived families, and no other token
- [ ] The scoped-token expander takes its content and format option ids from the registry's axes; no hand-typed axis id remains in it
- [ ] A drift guard test derives, from the registry's axes, the full expected token set per family and asserts each has a value; its expectation is never built through the expander
- [ ] Per-family tests at the module's interface cover: entity scope precedence (here, sub-location, reachable), the in-scene roster, Name content in every scope, stat pieces × format, trait groups per format, the persona's three contents and the known-person line for a world persona, lore split by position, Notes and Time placeholders when absent, and placeholder resolution applied to every value
- [ ] The authored adapter builds a Chip Scene from an authored world with the same preview options the Opening instrument passes today
- [ ] The World Editor's preview builder is deleted; the World Details Manager preview and the Opening instrument read the module through the authored adapter
- [ ] The World Details Manager tests and the Opening instrument tests pass without edits
- [ ] No rendered chip text changes: the same world previews to the same strings before and after
- [ ] Four gates green; `graphify update .` run; changelog entry under In Progress, 🛠️ Developer tooling

## Blocked by

- None (can start immediately)
