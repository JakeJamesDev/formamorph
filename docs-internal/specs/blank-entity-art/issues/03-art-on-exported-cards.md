# 03: Morph Art on Exported Character Cards

Status: ready-for-human
Status note: The id seed also falls back to the library item's id, so a world copy of a library entity gets the same art as the library tile. Awaiting a ruling on that.
Base: 22781db0
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Blank Entity Art](../spec.md)

**What to build:** A character card exported from an entity with no picture carries Morph art instead of the initials image. The card's WebP is 480 × 720, drawn with the dark-theme colors.

**Rationale for the model:** it swaps one image source for another inside an existing export path. Sonnet at medium effort.

## Acceptance criteria

- [ ] `placeholderPortrait` in `src/lib/entityFile.ts` is replaced. The export draws the generator's output to a canvas and encodes a WebP. The id seed is the entity's `sourceId` when it has one, else its id.
- [ ] The art uses the dark-theme colors whatever the current theme is.
- [ ] The export waits for the app font before it measures the letter. A card never bakes in a fallback font's letter.
- [ ] A name made only of chips resolves them before the letter is picked, as the current export does.
- [ ] The card still embeds its metadata and reimports with the same fields. Existing card round-trip tests pass.
- [ ] A test exports a blank entity and checks that the image is 480 × 720 WebP.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Add a 👤 changelog entry in the In Progress section.

## Scope notes

- **No world or save export-shape change.** The card's embedded data does not change. Only its picture does.
- Cards already exported keep their initials image.
