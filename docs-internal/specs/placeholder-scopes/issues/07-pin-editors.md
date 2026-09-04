# 07 — Pin editors: shared rows, location, descriptor, value, shared ConflictNote

Status: done
Type: task
Blocked by: 06
Spec: ../spec.md (Pins: Gating, Location editor, Descriptor editor, Value editor, Conflicts)

## Task

- Extract `components/editor/PlaceholderPinRows.tsx` from `managers/TraitManager.tsx:240-293`:
  the `<Select>` of placeholders (combined view, `Owner.Name` labels), the `TokenAutocomplete`
  value field, add and remove rows. Props: `pins`, `onChange`, `sourceRef` for the conflict note.
  `TraitManager` renders it.
- `components/editor/PinConflictNote.tsx` replaces `ConflictNote`: takes the world and the source
  being edited, lists every competing pin on the same placeholder from any source with its kind
  and name, and states which wins by the spec's precedence. Rendered under every pin editor.
- `managers/LocationManager.tsx`: a Placeholder Pins section, advanced mode, same `HelpButton`
  topic pattern (`worldEditor.placeholderPins` or a location-specific topic).
- `managers/StatDescriptorsSection.tsx`: a pin icon button per descriptor row (existing rows only),
  count badge when set, opening a `Popover` holding `PlaceholderPinRows`. Advanced mode.
  `modalPopover` per the Radix scroll-lock rule.
- `components/KeywordChips.tsx` (placeholder values only, via a prop): a pin icon on each value chip,
  count badge, same popover. Advanced mode. The chip's in-place edit on double-click is unchanged.
- A pin popover must not steal the palette claim from the field it sits in; check `ChipInsertTarget`
  release rules before shipping.

## Acceptance

- `TraitManager` tests still pass with the extracted rows.
- Location test: add a pin, see it on the location; `PinConflictNote` names a trait pinning the same
  placeholder and says the location wins.
- Descriptor test: the badge counts pins; the popover writes to
  `descriptors[i].placeholderPins`.
- Value test: the badge counts pins; the popover writes to `values[i].pins`; a pin whose value names
  the same placeholder is refused with a note.
- Simple mode shows none of it. Four gates green.

## Notes (resolved 2026-09-02)

- `pinsTargeting(world, placeholderId)` and `pinConflict(world, placeholderId, source)` landed in
  `lib/placeholderPins.ts` as the note's seam. Rows are `{ source, pin, name, label }` with `source` a
  `PinSourceRef` union; 08 adds `updatePinAt` / `removePinAt` on top rather than a second walker.
- `KeywordChips` got a generic `chipAside` slot; the pin button itself is the shared `PinPopoverButton`,
  which the descriptor rows use too. `useGameDataOptional` gives the library modals a null world.
- A value pin on the value's own placeholder is left out of the picker and flagged in red when stored;
  the core still applies it. 09's Bench rule should name it.
