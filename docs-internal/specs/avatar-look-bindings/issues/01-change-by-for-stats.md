# 01: Change By for Stats

Status: done
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

- [x] With `by` absent, the resolver gives today's results: a player value of 0.5 plus a full stat gives 1.5; above the authored max keeps growing; a raised live max doesn't shrink; percentage caps at 1. `avatarLook.test.ts`, "stats with no Change By".
- [x] A Change By of −1 shrinks the slider. `avatarLook.test.ts`, "shrinks the slider with a negative amount".
- [x] Two stats on one slider sum; both stay pickable in the editor. `avatarLook.test.ts` "sums two stats on one slider"; `StatManager.bodySliders.test.tsx` "keeps a slider another stat uses pickable".
- [x] A stat switched off by a trait toggle adds nothing, on the player and on an entity. `GameViewer.avatarLook.test.tsx` (both cases, through GameViewer), plus the resolver and entity-view tests.
- [x] A binding on Thickness drives a model that names the key Fat, and the output uses Fat. `avatarLook.test.ts` "drives a model's Fat from a Thickness binding". The viewers report the catalog through `onCapabilities` and `onMorphNames`.
- [x] The migration turns string bindings into objects on a current-version world, entity stats, stat-link overrides, a library record and a save; a second run changes nothing. `version.test.ts`, "stat bindings in the object form".
- [x] A Change By edited in the world shows in a loaded save. `GameplayContext.bindingRefresh.test.tsx`, a real save and load.
- [x] Mutation: restore last-wins for two stats, and skip the always-run step. The right tests fail each time. Also mutated: ignoring the toggle map, clamping number stats at 1, dropping the load refresh, and the entity effect ignoring its traits. Each failed its own test; all restored and grep-checked.

## Landed

**Not verified**
- The stat editor's Change By rows were not opened in a browser. Tests cover them through the DOM only. No frame exists.
- The real viewers reporting their keys (`onCapabilities`, `onMorphNames`) did not run with a model loaded. Until a viewer reports, names pass through as given and the viewer maps aliases as before.

**For you**
- Play a world with Stomach/Fatness bindings on an old save and confirm the body looks as it did (game view, entity view).
- Open a world stat with Body Sliders picked and judge the Change By rows: a name column, a **Change By** number column, and "Not on this model" under a missing slider. The layout is new; approve it or ask for another.
- History: a Change By edit records under the existing "Body Sliders" label. Say if it should read differently.
