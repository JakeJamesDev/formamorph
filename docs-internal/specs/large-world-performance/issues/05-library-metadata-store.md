# 05: Library Metadata Store

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: an IndexedDB schema upgrade on users' libraries with many write paths, a worker-side restore, and a blocked-upgrade case; mistakes lose or desync user data.

## What to build

The world library stops loading every world in full to list it (Q6). The world library database goes to version 2 and adds a metadata store keyed by world id, holding the list fields (name, description, author, thumbnail, tags, source and link fields, dirty, timestamps). World data stays in the existing store.

- The upgrade fills the metadata store with a cursor inside the upgrade transaction.
- A blocked upgrade (another tab on version 1) shows a visible message; the service closes its connection on a version change.
- Every write path writes matching metadata in the same transaction: store, content update, listing link, delete, default-world seeding, backup restore (worker side), and the dev and harness seed paths.
- Backup and restore open the database at the current version, not a fixed version 1.
- The Main Menu world list, the load-game dialog, the data provider's metadata refresh and the Test Bench's world lookup read metadata only. Publish linking and linked copies use metadata or keyed reads, never a whole-store read of world data.

Older builds can no longer open the library after the upgrade (Q16). Not a world or save export-shape change. One changelog fragment, Minor Fixed, 👤. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] fake-indexeddb: a version 1 library with three worlds upgrades to version 2 with three matching metadata records.
- [ ] Each write path (store, content update, listing link, delete, default seeding, restore) leaves metadata equal to the derived list fields of its world.
- [ ] Backup then restore at version 2 round-trips worlds and metadata.
- [ ] A second open connection at version 1 blocks the upgrade; the app shows the blocked message and continues after the other closes.
- [ ] No world-list read does a whole-store read of world data (asserted through the service seam).
- [ ] Harness: Main Menu heap with the bench library is within 50 MB of the empty-library control from ticket 01.
- [ ] Guard bites: skipping metadata in one write path turns its sync test red.
- [ ] Four gates green.
