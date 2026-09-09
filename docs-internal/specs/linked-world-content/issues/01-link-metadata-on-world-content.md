# 01: Link metadata on world content

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: this ticket fixes the data shape every later ticket reads, touches the export shape, and needs a careful idempotent migration across worlds, saves, and library records.

## Parent

[spec.md](../spec.md) — Linked world content: dependencies and optional add-ons. Sections: Terms, Local authoring, Linked state and update entry points, Settled follow-up decisions.

## What to build

An Entity or dictionary inside a world can carry a link record that says what it follows. The World Editor reads that record and shows one of three states beside the item: **Linked**, **Local replacement**, or nothing for an independent copy. The selected item's header names its source. Nothing else changes yet: no linking action exists, so the only way to see a state is a fixture or a hand-edited world, which the tests use.

The link record is local to the world copy and is the same for entities and dictionaries. It names the library item the copy follows, the published source when one exists, the source revision the copy holds, the revision the player last reviewed, and whether the copy is a local replacement. A copy with no record is independent. The reviewed revision exists so a kept revision does not return to review until the source changes again.

Library metadata already carries the community link fields; this ticket does not change them. The world record gains the relationship block additively. Worlds and saves without it load unchanged; the migration is idempotent and runs at the existing import and load boundaries.

Proposed shape, to settle in this ticket:

```ts
interface ContentLink {
  libraryId?: string;        // local library item this copy follows
  sourceId?: string;         // published listing, when the library item has one
  sourceRevision?: string;   // revision marker the copy holds
  reviewedRevision?: string; // last revision the player reviewed
  localReplacement?: boolean;
}
```

This is an export-shape change. Say so in the response and do not bump the version.

## Acceptance criteria

- [ ] A world with a linked dictionary and a linked Entity loads, and the World Editor list shows the link indicator on each; the header shows the state label and the source name.
- [ ] A world with no link records loads and shows no indicators; loading it twice through the migration yields identical data.
- [ ] A save made before this ticket loads unchanged.
- [ ] Export includes the link record; import restores it; a world file with unknown link fields is preserved rather than stripped, in a test that round-trips an extra field.
- [ ] Type check, lint, tests, and build pass; the response names the export-shape change.

## Blocked by

- None — can start immediately.
