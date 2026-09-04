# 07 — Chip popout re-pick + drill picker

Status: done
Blocked by: 06

Spec: `../ui-spec.md` (Drill picker, Chip popout decisions).

## Scope

- Drill picker component: "variants" and "slots — via whichever value rolls" sections, ⚠ on
  slots not present in every value, plain-value count noted as not addressable, inline create
  row. Kind nouns in section labels.
- Chip popout gains a re-pick row beside World/Unique, opening the drill picker seeded at the
  chip's current path.

## Done

- Tests: section membership, partial-slot marker, re-pick rewrites the chip path and keeps
  mode/placement id (mutation-proven). Radix/jsdom conventions respected.
- Live-verified via dev-router; four gates green; changelog entry appended.

## Answer

Shipped. `DrillPicker` (`src/components/prompt/DrillPicker.tsx`) reads two new vocabulary
seams — `structure(token)` (kind noun, trail, slots with a `partial` flag, plain-value count) and
`repoint(token, at)` — so the picker stays family-agnostic while the placeholder codec keeps owning
paths. `create(name, under?)` gained the second argument: created from inside a level, the new
placeholder is hung off that level as a value rather than added as one more root (story 12).

The pop-out's re-pick row sits under World/Unique as **Points At** + **Re-Pick…**, and the picker
replaces the pop-out's content in place rather than opening a second Radix layer. `repoint` is what
keeps mode and placement id: rows walked inside the seeded level already carry them, but the root
list and inline create do not, so one seam covers every source.

A chip whose path ends in a `slot` (or whose placeholder is gone) describes no level, so the picker
opens on the whole list — which is where re-aiming a broken chip has to start anyway.
