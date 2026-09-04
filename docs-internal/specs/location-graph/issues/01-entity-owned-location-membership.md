# 01 — Entity-owned location membership

**What to build:** Entities own the list of locations they belong to, per ADR-0003. An author edits a character's whereabouts on the entity itself; a location's editor still shows who is present there (computed by inversion). In play, every roster the AI sees — present here, in sub-locations, reachable, presence filtering — renders exactly as before for an equivalent world. Existing worlds migrate automatically at the same central point and import boundaries as prior shape changes.

**Blocked by:** None — can start immediately.

Status: ready-for-human
Status note: built and committed (b22e59d); the version bump and migration release are the user's call.

- [x] Entity carries a location-id list; the location-side entity list is removed from the world shape
- [x] Idempotent migration inverts existing worlds; migrating twice ≡ once
- [x] Equivalence: every AI-context roster (location, sub-location, reachable, scene-presence filter) produces identical output before vs after migration for the same world
- [x] Entity editor: add/remove locations on the entity
- [x] Location editor: entities-present view computed by inversion, still editable from the location side (writes go to the entity field)
- [x] Multi-location entity remains present at all listed locations simultaneously
- [x] Runtime discovered entities keep working unchanged (they already carry their own location)
- [x] Response includes the export-shape reminder; no version bump
- [x] Four gates green; changelog In-Progress entry appended

## Comments
