# 06: Script Layer Control

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Scripts read and set a Layer's Variant, opacity and tint per subject. The spec covers this in Q10, Q14 and its Scripts section.

- **Save shape.** Media overrides gain per-subject Layer settings. Per entity, Generic instance, location and Item Instance, keyed by layered entry id and Layer id: an optional Variant media id, opacity and tint. Writes go through the existing media-override write path, so they land at commit, save with the turn and undo with it.
- **Script surface.** Entity, persona, Generic instance, location and Item Instance entries gain `layers`, keyed by Layer name. It addresses the rig the subject shows now. Each Layer has `variant` (image name), `opacity` and `tint`, which scripts can read and set. Clearing one restores the rules or the authored value. A missing Layer, or a name that is not one of that Layer's Variants, stops the script with an error that names it.
- **Resolver.** Settings beat rules (Q10).
- **Whole-image setter.** Accepts a layered entry's name.
- **Renames.** Renaming a Layer or a Variant's image rewrites script text through the existing Media List rename tooling.
- **Test Bench.** Logs each Layer write with Layer, field and value.
- **Tint before 04.** If ticket 04 has not landed, a `tint` write stores and reads but does not draw. Say so in the Landed section.
- **Docs.** Scripts Reference and Scripts Guide document `layers`.

## Acceptance criteria

- [x] Script-runner tests cover reads, writes, clears, both errors, Generic instance and Item Instance separation, and the whole-image setter with a layered name. `statCodeExecutor.layers.test.ts` (11 tests); each guard mutation-tested, 16 mutants, all killed.
- [x] A reload restores scripted Layer settings, and undo removes them. `GameplayContext.mediaOverrides.test.tsx`: save, load and rewind with Layer settings in the overrides; `imageVisibility.layerSettings.test.ts` draws them.
- [x] Renaming a Layer rewrites a script that names it. `LayeredImageEditor.test.tsx` "offers to rewrite the scripts that name a Layer when it is renamed" (the Layer Name field, wired per Q32 since 02 landed first); `statCodeRename.layers.test.ts` for the rewrite forms.
- [x] Changelog fragment written. `docs-internal/changelog.d/layered-images-06.md`.

⚠️ Export shape: the save file gains per-subject Layer settings.

## Landed

**Not verified**
- Tint draws: ticket 04 landed first, so `resolveLayered` lays a script's tint (stored as lowercase `#rrggbb`, Q34) over the authored one, and a script read falls back to the authored tint. Checked in `imageVisibility.layerSettings.test.ts`, not on screen.
- No live turn was played. The commit path was checked through the save round trip and the visibility seam, not in a game.

**For you**
- A script cannot say which Layered Image a Layer name reaches. Renaming "Hat" in one rig rewrites every `layers.Hat` in scripts, including ones meant for another rig with a Layer of that name.
- Rename a Layer in **Edit Layers** in a world whose script names it: the Update Code question appears, as for an image rename.
- `layers` read on a subject showing a plain image lists no Layers. Any Layer name then stops the script ("entities.Mira shows no Layered Image, so it has no Layer "Hat"").
