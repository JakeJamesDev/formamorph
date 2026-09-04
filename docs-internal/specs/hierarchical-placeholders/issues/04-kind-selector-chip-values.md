# 04 — Kind selector + chip-capable values input

Status: done

Spec: `../ui-spec.md` (Kind selector, Values input decisions).

## Scope

- Wildcard | Object ToggleGroup in the placeholder manager; writes the explicit flag; creation
  writes Wildcard; enabled at one value; legacy rows show inferred kind until touched.
- State line under the selector: Variable at one value, else "Picks one of N values" /
  "Shows all N values". Two-layer copy (brief line + ⓘ tip).
- Values input gains placeholder-chip capability (alias-style extension): lone-chip values
  render as full-path pills, mixed values render embedded pills, in-place edit preserved.

## Done

- Manager tests cover: creation default, selector writes flag, re-click does not clear, state
  line per kind and count, lone-chip pill rendering. Guards mutation-proven.
- Live-verified via dev-router at realistic viewport; four gates green; changelog In-Progress
  entry appended.
