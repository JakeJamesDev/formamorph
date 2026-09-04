# 06 — Pin core: four sources, precedence, fixed point, runtime + pre-game

Status: done
Type: task
Blocked by: 01
Spec: ../spec.md (Pins: sources table, Precedence, Chains, Pre-game, Init, Author draws, Masking)

## Task

- `types/world.ts`: `PlaceholderPin { placeholderId, value, valueId? }`; keep
  `TraitPlaceholderPin` as an alias. Add `GameLocation.placeholderPins?`,
  `StatDescriptor.placeholderPins?`, `PlaceholderValue.pins?`.
- New `lib/placeholderPins.ts` (pure): `collectPins({ traits, disabledTraitIds, location, stats,
  statValues, placeholders, rolls })` returns `Record<placeholderId, string>` layered in order
  trait → location → descriptor (later wins), then value pins to a fixed point below all three.
  Value pins read the effective world value: roll masked by the pins gathered so far. Stop at the
  first repeated state and report a cycle through an `onFinding` callback. `withPinnedValue` and
  `activePlaceholderPins` move here from `lib/traitEffects.ts`, re-exported.
- Priming: `allPinTexts` covers every source; a placeholder with any value pins gets a world roll
  primed even with no world-mode chip.
- Runtime: `useResolvedWorld.ts:120-126` builds pins through `collectPins` with the current
  location (by id) and `playerStats` values. `usePlaceholderResolver.ts` uses the view-aliased
  location and stats. `GameViewer.tsx` `changeLocation` needs no change: the location id in state
  drives the collection.
- Init: `GameViewer.tsx:3549` and `:3576` `resolveWith` take the full collection with the chosen
  starting location and post-trait starting stats.
- Pre-game: `MainMenu.tsx:301-305` `draftPins` layer in descriptor pins from starting values after
  draft trait effects and location pins from the picked starting location.
- Author draws: `drawPlaceholderOnce` / `drawPlaceholderSpans` and `buildPlaceholderPreview` apply
  the drawn values' pins inside the same draw (a per-draw `pins` map fed from the values chosen).
- **Export-shape change**: say so in the response.

## Acceptance

- Pure tests, mutation-proven: precedence across all four sources on one placeholder; a value pin
  following a trait-pinned source; a two-step chain; a cycle reported once and terminating; an empty
  pin value skipped; a disabled stat contributing nothing.
- `GamePanels.test.tsx`: a location pin applies on arrival and releases on the next location; a
  descriptor pin flips when the stat crosses the threshold; the stored roll is untouched.
- Draw test: rolling a value with a pin shows the pinned text for the pinned placeholder.
- Four gates green.
