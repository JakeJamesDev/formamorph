# 01 — Bench surface + Issues tracer

Status: done

**What to build:** The Test Bench exists and catches its first real bug class. A persistent icon
button in the World Editor header opens the Bench — a third resizable panel on desktop, a
full-height sheet on mobile — with the variant-A chrome: bench header row, lens bar placeholder,
horizontal tab strip (Issues · Triggers · AI Context · Opening; unbuilt tabs disabled), content
area. The Issues instrument runs a new pure rule engine (`runRules(world) → Finding[]`) carrying
the alias-hygiene rule pack (leading article, cross-entity collision, self-duplicate alias), grouped
by severity, same-rule findings collapsed into one row naming the items. The button carries a count
badge that updates debounced as the world changes and stays quiet at zero. Clicking a finding's
Open selects the owning editor tab + item (on mobile: closes the sheet and lands on the normal
list-detail navigation). Dev-route coverage for the Bench (open + tab).

**Blocked by:** None — can start immediately.

**Reference:** the layout prototype lives on branch `prototype/test-bench-layout` (commit
`609ace7`) — variant A in `TestBenchPrototype.tsx` is the confirmed chrome (header row → lens row →
tab strip → content), and its WorldEditor mounts show the intended integration points (header
button, third panel, mobile drawer). Prototype code — steal the structure, rewrite the code.

**Status:** done

- [x] Bench opens/closes from the header button on desktop (resizable third panel) and mobile (sheet)
- [x] Badge shows the live finding count, debounced, hidden at zero; header row does not reflow
- [x] Alias-hygiene rules fire on a seeded world and collapse into grouped rows
- [x] Open navigates to the owning tab with the item selected, both layouts
- [x] Rule engine is pure and fixture-tested (defective world → findings; corrected world → silence)
- [x] Bench reachable in one dev-router `goto`; works in both Simple and Advanced modes
- [x] No world/export shape change; all Bench state is local
