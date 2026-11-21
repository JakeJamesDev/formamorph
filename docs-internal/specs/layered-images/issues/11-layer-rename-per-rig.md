# 11: Layer Rename Rewrites Only That Layered Image's Scripts

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Renaming a Layer in Edit Layers offers to rewrite scripts (ticket 06, Q33). Today it rewrites every `layers.<old name>` in every script, so a Layer with the same name in another Layered Image loses its script references. The spec covers this in Q14, Q31 and Q36.

- **Sure references.** A reference whose subject is a named entity, location or item (`entities.Wren.layers.Hat`) is rewritten only when that subject links the renamed Layered Image and links no other Layered Image with a Layer of the old name.
- **Unsure references.** A reference whose subject is only known at run time (`self`, `owner`, `persona`, an instance loop, a computed key), or whose subject links several Layered Images with a Layer of the old name, is listed apart in the Update Code question. The author decides for those; they are not rewritten by default.
- **Untouched references.** A reference whose subject links no Layered Image with the renamed Layer is left alone and not listed.
- The Variant image rename offer is unchanged: image names are unique per world.
- **Docs.** The Scripts Guide says how a Layer rename treats scripts.

## Acceptance criteria

- [ ] Two Layered Images each have a Layer "Hat". Renaming one rewrites a named subject's reference only when that subject links the renamed one. Covered by a rename test.
- [ ] A `self.layers.Hat` reference shows in the Update Code question as unsure and is not rewritten unless the author picks it.
- [ ] A world with one Layered Image behaves as today: every sure reference is rewritten.
- [ ] Frame `.scratch/frames/layer-rename-question-dark.png` of the Update Code question with sure and unsure references, at a desktop width.
- [ ] Changelog fragment written.

For you: rename a shared Layer name in a world with two rigs and judge whether the question reads clearly (Edit Layers).
