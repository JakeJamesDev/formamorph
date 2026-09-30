# 03: One grid render per catalog answer

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

State batching and identity reuse across a hook and the card tree; subtle staleness bugs are possible.

## What to build

Spec Q9. Opening Community Creations renders the grid once per catalog answer, not three or four times. Cards are memoized. When the fresh catalog lands, a row that matches its cached copy keeps the cached object, so its card does not render again. Hearts, counts, and the anonymous-likes flag stay correct.

## Acceptance criteria

- [ ] The catalog loader sets rows, the anonymous-likes flag, and the syncing flags in one commit per step.
- [ ] A fresh row equal to its cached row keeps the cached object; a changed row replaces it.
- [ ] A card whose row did not change skips the render when the fresh catalog lands.
- [ ] A change of reader still clears the old reader's rows before the forced request.
- [ ] Tests at the catalog sync seam and the card render seam (React `Profiler`) prove each rule, and each fails when its rule is removed.
- [ ] Harness numbers before and after are recorded under `## Comments`.
