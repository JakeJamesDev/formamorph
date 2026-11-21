# 06: Script Layer Control

Status: ready-for-agent
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

- [ ] Script-runner tests cover reads, writes, clears, both errors, Generic instance and Item Instance separation, and the whole-image setter with a layered name.
- [ ] A reload restores scripted Layer settings, and undo removes them.
- [ ] Renaming a Layer rewrites a script that names it.
- [ ] Changelog fragment written.

⚠️ Export shape: the save file gains per-subject Layer settings.
