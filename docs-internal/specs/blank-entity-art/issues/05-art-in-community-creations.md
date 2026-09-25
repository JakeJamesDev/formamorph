# 05: Morph Art in Community Creations

Status: ready-for-human
Status note: The details window shows the portrait art whole, with gray bars at the sides of its wide frame. The website profile reaches three more modules (site boundary ceiling 40 → 43).
Base: 3ea0f79d
Blocked by: 02, FormamorphServer 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Blank Entity Art](../spec.md)

**What to build:** A listing that the server marks `placeholder: true` shows Morph art instead of its stored thumbnail, on every community surface. The id seed is the listing id.

**Rationale for the model:** it reads one new field and reuses the ticket 02 component on known surfaces. Sonnet at medium effort.

## Acceptance criteria

- [ ] `WorldRecord` handling reads `placeholder` from the listing. A listing without the field shows its thumbnail as it does today, so an older server still works.
- [ ] These surfaces show the art for a flagged entity listing: the community card, the details window, a profile's creations and likes tabs, and any other place that shows a listing thumbnail. Search for every `thumbnail_file` render to find them.
- [ ] A flagged listing does not fetch or cache its thumbnail file.
- [ ] A downloaded blank entity matches its community card in the library (same hue and shape).
- [ ] Tests: a flagged listing renders the art and requests no thumbnail; an unflagged one renders its image.
- [ ] Preview check at 1600 px and on a phone, in both themes, against a server with ticket 04.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Add a 👤 changelog entry in the In Progress section.

## Scope notes

- **No world or save export-shape change.** The listing gains a server field, which is an API shape change only.
- Avatar listings keep the silhouette.
