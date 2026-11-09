# 01: Change By for Stats

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A schema change with a migration across five storage places, plus the new resolver that every later ticket builds on. It needs judgment.

## What to build

A stat's body slider binding gets a **Change By** amount (Q1). The slider value is the player's value plus `t × by` for every bound stat, summed (Q9). Absent `by` is 1, so every world already out there looks the same.

- `morphBindings` becomes a list of `{ name, by? }`, on stats and on stat-link overrides.
- One always-run migration step, above `migrateWorld`'s same-version early return, turns string entries into `{ name }`. It covers world stats, entity stats, stat-link overrides, library records and save stat copies. It is idempotent. The legacy auto-bind writes the new form.
- On load, the saved-stat refresh also re-reads `morphBindings` from the world (Q17).
- **This ticket owns the resolver** (spec, "One resolver"), sliders only. Inputs: the customization, the model's key catalog, the active stats with their authored twins. It skips keys the model lacks and resolves aliases to the model's own name before merging. A stat off by `enabled` or by a trait stat toggle adds nothing, for entities as for the player. It replaces `mergeBodyMorphs` and `statMorphMap`; the player Avatar and entity Avatars (VRM and non-VRM lanes) read it. Leave room for trait pins (ticket 03) and color plans (ticket 04).
- The rule that hides a slider another stat uses goes, with `boundMorphNamesExcluding`.
- The stat editor keeps the Body Sliders multi-select. Each picked slider gets a row below it with a Change By number. A row whose slider the known model lacks shows "not on this model" (Q14).
- Update the stat editor's Body Sliders hint, the World Editor stats page, the world format page, the Avatars page and the history labels. Add a changelog fragment.

⚠️ Export shape: world and save `.json` change. Name it in the landing message.

## Acceptance criteria

- [ ] With `by` absent, the resolver gives today's results: a player value of 0.5 plus a full stat gives 1.5; above the authored max keeps growing; a raised live max doesn't shrink; percentage caps at 1.
- [ ] A Change By of −1 shrinks the slider.
- [ ] Two stats on one slider sum; both stay pickable in the editor.
- [ ] A stat switched off by a trait toggle adds nothing, on the player and on an entity.
- [ ] A binding on Thickness drives a model that names the key Fat, and the output uses Fat.
- [ ] The migration turns string bindings into objects on a current-version world, entity stats, stat-link overrides, a library record and a save; a second run changes nothing.
- [ ] A Change By edited in the world shows in a loaded save.
- [ ] Mutation: restore last-wins for two stats, and skip the always-run step. The right tests fail each time.

For you: play a world with Stomach/Fatness bindings on an old save and confirm the body looks as it did (game view, entity view).
