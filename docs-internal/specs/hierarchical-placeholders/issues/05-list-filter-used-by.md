# 05 — List filter + used-by hints

Status: done
Blocked by: 04

Spec: `../ui-spec.md` (List decision).

## Scope

- Hide-referenced-parts filter on the placeholder list (a part = appears as a lone-chip value
  of another placeholder); default shows all.
- "Used by N" hint on referenced rows, derived from the backend collection helpers (no second
  scanner).

## Done

- Tests: filter hides exactly the referenced set, hint counts match, unreferenced placeholders
  unaffected (mutation-proven).
- Live-verified via dev-router; four gates green; changelog entry appended.
