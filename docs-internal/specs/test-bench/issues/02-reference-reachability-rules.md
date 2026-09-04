# 02 — Reference-integrity + reachability rules

**What to build:** Issues catches everything that points at nothing or can never happen. New rule
packs in the existing engine: orphan entity references in locations, missing stat/placeholder ids in
trait toggles and pins, chips referencing undefined placeholders or sitting in never-scanned fields,
stat-code references to nonexistent stat names, secondary keys with no primary keywords, entries
with no keywords that aren't constant, no starting location, the dead legacy start field, entity in
zero locations, disabled stat no trait ever enables, regex entries that don't compile. Findings
appear in the Issues tab with severity and navigation like any other.

**Blocked by:** 01 — Bench surface + Issues tracer.

Status: done

- [x] Each rule has a fixture pair (defect present → finding; corrected → silence)
- [x] The Centaur Breeder-class defects (no starting location, entity nowhere, dead legacy field) all fire
- [x] Severity assignments match the spec's Appendix A
- [x] Rules about advanced-only features stay silent for worlds that don't use them

**Implementation notes (2026-08-16):** 13 rules added to `lib/testBench/rules.ts` in three packs
(reference integrity / dictionary can-never-fire / reachability). Appendix A's "entity list references
a missing entity id" maps to the entity-owned membership model as `entity-location-orphan`
(`Entity.locations` naming a dead location id). The legacy field is `isStartLocation`, detected via
`in`. Chip rules mirror the priming pass's field list (PlaceholderSessionContext); regex compilation
mirrors `dictionaryUtils.keyMatcher` flags. `FindingItem` gained an optional per-item `section`
override so `chip-unknown-placeholder` (rule section: placeholders) opens each finding on its owner's
tab. Not covered (adjacent, named for a later ticket): location `parentId` orphans, `Connection`
endpoints naming dead locations, `StatUpdate.stats` naming missing stat names.
