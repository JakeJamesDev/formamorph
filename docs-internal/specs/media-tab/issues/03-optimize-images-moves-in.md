# 03: Optimize Images Moves In

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Moves an existing action and switches its scan to the media index. The risk is in the optimize pipeline's slot list and its apply step, which must now write dictionary thumbnails too.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

**Optimize Images** leaves the World Editor app bar and becomes the last icon in the Media tab header, in both editor modes (Q7, Q9). It keeps its downscale consent dialog, its progress (a spinner on the icon, progress in its tooltip), its cancel-on-close behavior, and its single history step.

The optimize scan reads the media index's image items instead of the old image slot list, so dictionary thumbnails are optimized under the thumbnail budget along with the world thumbnail, entity gallery images and location backgrounds. The apply step writes dictionary thumbnails back. The import-time optimize on the main menu uses the same list.

When the run finishes, card sizes, section totals and the meter update.

Update the wiki lines that place Optimize Images in the app bar. Changelog fragment for the move and the dictionary thumbnails.

## Acceptance criteria

- [ ] The app bar has no Optimize Images button in either mode
- [ ] The Media tab header's Optimize Images runs in Simple and in Advanced
- [ ] A world with an oversized dictionary thumbnail gets it shrunk under the thumbnail budget
- [ ] World thumbnail, gallery images and location backgrounds are still optimized as before
- [ ] One undo reverts the whole run
- [ ] Closing the editor mid-run cancels it and writes nothing
- [ ] After a run, the affected cards and the meter show the new sizes
