# 11: Layer Rename Rewrites Only That Layered Image's Scripts

Status: ready-for-human
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

- [x] Two Layered Images each have a Layer "Hat". Renaming one rewrites a named subject's reference only when that subject links the renamed one. Covered by a rename test. (`statCodeRename.layers.test.ts`, "rewrites a named owner only when it links the renamed one alone…"; mutation-checked)
- [x] A `self.layers.Hat` reference shows in the Update Code question as unsure and is not rewritten unless the author picks it. (unit "rewrites a picked reference…"; `LayeredImageEditor.test.tsx` "lists a reference another Layered Image may own apart…" checks the row starts unchecked and is rewritten once picked)
- [x] A world with one Layered Image behaves as today: every sure reference is rewritten. ("a Layer rename when no other Layered Image has the Layer name"; the existing rename test still passes)
- [x] Frame `.scratch/frames/layer-rename-question-dark.png` of the Update Code question with sure and unsure references, at a desktop width. (1280×800 dark, dev route `#dev?view=mainMenu&modal=codeRename&fixture=layers`, taken with Playwright)
- [x] Changelog fragment written. (`docs-internal/changelog.d/layered-images-11.md`)

For you: rename a shared Layer name in a world with two rigs and judge whether the question reads clearly (Edit Layers).

## Landed

**Not verified**
- None.

**For you**
- For you: rename a shared Layer name in a world with two rigs and judge whether the question reads clearly (Edit Layers).
- The question with sure and unsure references: `.scratch/layered-images-11/frames/layer-rename-question-dark.png`.
- Follow-up: item scripts (`Item.scripts`, where `self` is the item) are in no rename's scan, for any rename root. This gap is older than this ticket.
