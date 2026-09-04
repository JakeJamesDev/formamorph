# 02 — Palette bar: chevron toggle, owner headings, bare names under owners

Status: done
Type: task
Blocked by: 01
Spec: ../spec.md (Palette bar; Icons)

## Task

- `src/components/prompt/PlaceholderPaletteBar.tsx`: the toggle button loses its visible text when
  open. It keeps `aria-label="Placeholders"` and gains a tooltip "Placeholders". Collapsed, it
  still reads "Placeholders (N)".
- Owner heading rows render quiet text with the owner icon — `User` for entities, `BookOpen` for
  books — and the owner name rendered through `PlaceholderText`, so a placeholder inside the name
  shows as a pill inline. No chip surface of its own: a heading is not placeable. That pill is
  neutral rather than the placeholder's accent, so it does not read as a chip to drop in a field.
  Static: no hover state, no click.
- Folder heading rows stay `text-meta text-muted-foreground`.
- Chips under an owner heading render the row's bare label.
- Extract the owner heading as a small shared component (`OwnerHeading`) since tickets 03 and 04
  reuse it. `PlaceholderText` gains a `neutral` prop to draw the muted pill.

## Acceptance

- `PlaceholderPaletteBar.test.tsx`: toggle found by accessible name with no visible text when
  open; collapsed shows the count; strip reading shows `[Keeper]` with the entity icon by
  accessible name and no chip surface, and `Mood` bare beneath it; a chip-named owner shows a
  neutral pill while the same placeholder below keeps its accent; folder headings unchanged.
- Live check per the `verify-ui` skill at a realistic viewport, both themes.
- Changelog 👤 In-Progress entry.
- Four gates green. `graphify update .` run.
