# 02 — Connection records and effective navigation

**What to build:** Connections become world-level records `{id, from, to, twoWay, aiHint?}` (id-based, rename-proof), and navigation follows the effective-navigation rule of ADR-0002: implicit navigation (parent + children + siblings; top-level locations are not siblings) survives only for pairs with no authored Connection; a Connection's directions are all that remain for its pair. A player at the far end of a one-way Connection is simply never offered the return trip — no prompt text about direction anywhere. The travel hint renders as a `— via <hint>` suffix on the destination line. Old name-based connection lists migrate by pair-merge: reciprocal declarations → one two-way record, unmatched → one one-way record, dangling names dropped.

The prototype's pure rules module (in `prototype.html` beside the spec) is the lift-ready reference implementation; see the spec's inlined core.

**Blocked by:** None — can start immediately (parallel to 01).

Status: ready-for-human

- [x] Connection record type on the world; old name-list field removed from the shape
- [x] Pair-merge migration: reciprocal merge, unmatched one-way, dangling dropped, idempotent
- [x] Migration equivalence: effective destinations per location identical before vs after migrating a legacy world
- [x] One-way asymmetry: A→B offered at A, absent at B — including between siblings (override) and across trees
- [x] Worlds with no Connections navigate exactly as today (implicit set untouched)
- [x] Hint suffix appears on the destination line; no direction language in any prompt text
- [x] Router matches replies against effective candidates only (verified through the Turn Pipeline's fake adapter)
- [x] Directed reachability from starting locations available from the rules module (consumed by ticket 04)
- [x] Deleting a location deletes its Connections
- [x] Response includes the export-shape reminder; no version bump
- [x] Four gates green; changelog In-Progress entry appended

## Comments
