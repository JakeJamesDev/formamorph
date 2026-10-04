# 12: Mascot card

Status: ready-for-human
Blocked by: 09, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The player exports the mascot as one image and imports another's.

- Export writes a `.webp` that renders the Initial composition, with the rig in the image metadata as an entity card does: a marker, a version, the rig with every image in full as base64, the picks, the Mask, the transition and the Voice.
- Import parses strictly and names the bad field. It replaces the whole rig or nothing: images go to the store first, the rig applies last; a failure leaves the current rig and store as they were.
- The card is a new export shape with a version from its first release.

Spec: Q16, Q27, Q29, Q31; Implementation → Mascot card.

Recommended model rationale: a new export shape with an all-or-nothing import against a blob store.

## Acceptance criteria

- [ ] A round trip through export and import gives the same rig, images included.
- [ ] A file with an unknown version or a bad field is refused by name and changes nothing.
- [ ] The card's visible image is the Initial look.
- [ ] The export shape reminder is in the response and the changelog lead.
- [ ] The four gates are green.
