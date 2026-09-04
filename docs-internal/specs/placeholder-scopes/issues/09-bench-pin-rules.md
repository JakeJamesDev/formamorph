# 09 — Bench rules for pins across sources

Status: done
Type: task
Blocked by: 06
Spec: ../spec.md (Pins: Bench)

## Task

- `lib/testBench/rules` (follow the existing `placeholder-weight-unknown-value` rule pattern):
  - `placeholder-pin-conflict`: two or more pins on one placeholder from different sources that can
    be active together. Reports each source and the winner by precedence. Skips exclusive-group trait
    pairs and descriptor bands of the same stat.
  - `placeholder-pin-cycle`: value pins that reach a fixed-point repeat. Reports the chain.
  - `placeholder-pin-unknown-value`: a pin whose `valueId` names no value, or whose text matches
    none. Every source, not only traits.
  - `placeholder-pin-broken`: a pin naming a deleted placeholder, every source. Extends
    `BrokenPin` in `lens.ts:152`.
- `lens.ts` `pins` and `opening.ts` `openingPins` build through `collectPins` so the lens shows the
  same layered result play would.
- Roll texts, pinned values and pin lines in the Bench resolve through the four-source collection.

## Acceptance

- One fixture per rule, each proven by removing the condition and seeing the rule go quiet.
- `lens.ts` test: a location pin and a descriptor pin appear in the lens with the winner marked.
- Four gates green.

## Notes (resolved 2026-09-02)

- `lib/placeholderPins.ts`: `collectPinLayers(src)` → `{ pins, layers: PinLayer[] }`, one walk with the
  working shown — each layer is `{ source: PinSourceRef, pin, placeholderId, value, wins }` in the order
  play lays them; `collectPins` is its `.pins`. `PinSources.location` now needs an `id` for the source
  ref. `allPinRows(world)` walks every source; `pinsTargeting` filters it. `PinFinding.loop` carries the
  cycle's states as effective values of the looping placeholders.
- `testBench/lens.ts`: `pins`, `pinLayers` (layers + the editors' `label`) and `brokenPins` (now with a
  `source` label) build through the collector over the active traits (defaults + PC), the lens location,
  and `startingStatsWith` stats. `testBench/opening.ts`: `openingStart(world, lens)` and
  `openingPins(world, start, rolls)`; reroll keeps rolls under any source's pin.
- Rules: `placeholder-pin-broken` (error) replaces `trait-pin-invalid`, every source, empty rows skipped.
  `placeholder-pin-unknown-value` (warning) flags a dead `valueId` only — a pin with off-list text and no
  id stays the feature; its fix re-links by exact text, else drops the id (`withMappedPins`).
  `placeholder-pin-conflict` (info) reuses `pinConflict` for who competes; pins forcing the same text
  are no conflict. `placeholder-pin-cycle` (error) takes each Tarjan SCC of value-pinning placeholders and
  probes its roll combinations through `collectPins`, up to `CYCLE_PROBE_CAP` (4096).
- The self-pin rule (a value pinning its own placeholder) landed in ticket 10 as `placeholder-pin-self`.
  The cycle probe leaves trait/location/band pins out (they fix values, never start a loop). Dismissals
  keyed on the old `trait-pin-invalid` id resurface under the new rule id.
