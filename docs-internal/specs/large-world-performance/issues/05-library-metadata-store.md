# 05: Library Metadata Store

Status: ready-for-human
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

- [x] fake-indexeddb: a version 1 library with three worlds upgrades to version 2 with three matching metadata records.
- [x] Each write path (store, content update, listing link, delete, default seeding, restore) leaves metadata equal to the derived list fields of its world.
- [x] Backup then restore at version 2 round-trips worlds and metadata.
- [x] A second open connection at version 1 blocks the upgrade; the app shows the blocked message and continues after the other closes.
- [x] No world-list read does a whole-store read of world data (asserted through the service seam).
- [x] Harness: Main Menu heap with the bench library is within 50 MB of the empty-library control from ticket 01.
- [x] Guard bites: skipping metadata in one write path turns its sync test red.
- [x] Four gates green.

## Results

Measured 2026-10-06, production build, 6x CPU. Before is ticket 01's baseline on the same machine; after is this branch.

| Step | Before | After |
|---|---|---|
| Main Menu heap, bench library | 68–71 MB | 72 MB |
| Main Menu heap, empty library | 27 MB | 27 MB |
| Open the editor: worst block | 2.0–2.8 s | 2.6 s |
| Typing: worst block | 61 ms | 69 ms |
| Save: wall time / worst block | 11.1 s / 2.7 s | 9.9 s / 3.0 s |
| `idb` get / put / getThenPut: worst block | 0.33–0.36 / 0.76–0.81 / 1.1 s | 0.35 / 0.85 / 1.15 s |

- The bench menu sits 45 MB above the empty control, inside the 50 MB bar.
- The menu heap after GC doesn't move: the win is transient. `getWorldMetadata` read every world in full on each menu mount; it now reads the metadata store only.
- `storeWorld` reads its sticky fields from the metadata record, not the old world record. Save drops that ~126 MB read; ticket 13 owns the remaining copies.
- The other steps are this branch's base, and vary run to run. The canvas still draws 23,100 edges here, since ticket 03 had not landed at Base.

Guard bites (each mutation reverted afterward):

| Mutation | Red test |
|---|---|
| `storeWorld` writes the world store only | store, sticky fields, delete, default seeding |
| `updateWorldContent` skips metadata | content update |
| `linkWorldToListing` skips metadata | listing link |
| `deleteWorld` leaves the metadata record | delete |
| restore writes the world store only | restore round trip, ticked-entries restore |
| upgrade skips the fill | the version 1 upgrade |
| no blocked toast | the blocked-upgrade test |
| no close on `versionchange` | the newer-version test |
| list reads use `getAll` on the world store | upgrade, content update, whole-store spy |
