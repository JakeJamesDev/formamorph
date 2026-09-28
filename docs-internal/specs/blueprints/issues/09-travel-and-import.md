# 09: Travel and import

Status: ready-for-human
Base: bdc06209
Blocked by: 03 — Link overrides in the editor; 05 — Automatic copies and rewrites; 06 — Pins by blueprint
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Rationale: extends the portable-traits rebind rule to blueprints and copies. Known pattern, several file formats, one rewrite reused from ticket 05.

Parent: [Blueprints spec](../spec.md)

## What to build

An entity card carries the blueprints its copies reach, so a library persona's copies keep their origin in another world. A link's overrides, with their snapshots, travel with the link. On import a copy binds its blueprint by id, then by unique name. With no match the copy becomes a plain owned placeholder with its resolved values, and every pin on the card that named the blueprint is rewritten to that placeholder, the same rewrite Detach uses.

## Acceptance criteria

- [x] Round-trip tests cover a card carrying blueprints, import with the blueprint present (bound by id, then by name), and import without it (plain copy, pins rewritten).
- [x] Link overrides and snapshots survive a card round-trip.
- [x] Each guard is proven to fail with its rule removed.
- [x] The response names the export-shape change: blueprints carried on the entity card.
