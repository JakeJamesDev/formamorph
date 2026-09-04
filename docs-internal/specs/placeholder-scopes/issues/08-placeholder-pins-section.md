# 08 — Placeholder Pins section

Status: done
Type: task
Blocked by: 07
Spec: ../spec.md (Pins: Placeholder Pins section)

## Task

- `lib/placeholderPins.ts`: `pinsTargeting(world, placeholderId)` landed in 07. It walks traits,
  locations, stat descriptors and placeholder values and returns `PinRow { source, pin, name, label }`
  sorted by precedence (descriptor, location, trait, value); `source` is the `PinSourceRef` union
  (`{ kind: 'trait' | 'location', id }`, `{ kind: 'descriptor', statId, descriptorId }`,
  `{ kind: 'value', placeholderId, valueId }`) and is enough to write back. Add
  `updatePinAt(world, source, pin)` and `removePinAt(world, source, pin)` returning a new world; a
  source may carry several pins on one placeholder, so the pin itself picks the row.
- `managers/PlaceholderManager.tsx`: a Pins section, advanced mode, below Values. Each row shows the
  source label (`Trait: Sworn`, `Location: Fen`, `Hunger ≤ 20`, `Region = Northern`), the value
  field (`TokenAutocomplete` over this placeholder's values), a re-aim control (a `<Select>` of
  sources of the same kind), and remove.
- Add: a kind picker (Trait, Location, Stat descriptor, Placeholder value), then a source picker for
  that kind (descriptors listed as `Stat: band`, values as `Placeholder = value`), then the value
  field. Writes a pin on the chosen source.
- `PinConflictNote` under the section, scoped to this placeholder.
- The library modals mount `PlaceholderEditor` with no world; the section is hidden there.

## Acceptance

- `pinsTargeting` test: one pin of each kind on one placeholder, rows in precedence order, write
  back through `updatePinAt` lands on the source, `removePinAt` clears it.
- `PlaceholderManager.test.tsx`: add a location pin from the section, see it on the location; edit
  its value; re-aim it to another location; remove it. Hidden in the library modal.
- Four gates green.

## Notes (resolved 2026-09-02)

- `lib/placeholderPins.ts`: `addPinAt(world, source, pin)`, `updatePinAt(world, source, pin, next)` and
  `removePinAt(world, source, pin)` are generic over the world (`W extends PinEditorWorld`) and return the
  same reference when the source or row is not there; rows are matched by `samePin` (placeholder, value
  and value id), so `updatePinAt` takes the old pin and the new one. An emptied list is dropped, not
  stored as `[]`. `pinSourcesOfKind(world, kind, placeholderId)` feeds the add and re-aim pickers with
  `{ source, label }` rows; `pinSourceKey(source)` is the Select value / React key. `pinsTargeting` and the
  pickers share one `labeler`.
- `components/editor/PlaceholderPinsSection.tsx` holds the section (the manager only mounts it behind
  `advanced && world`). Its `PinsWorld` is `PinEditorWorld` plus the four writers; the GameData context
  value satisfies it. A write is `updatePinAt`/`removePinAt`/`addPinAt` then a per-kind switch handing the
  rewritten trait/location/stat/placeholder to the matching updater — re-aim is remove + add and commits
  both sources. Add writes an empty pin the moment the source is picked; the row's value field fills it.
- Each row's Select shows the row's own `label` (`Trait: Sworn`, `Location: Fen`, `Hunger ≤ 20`,
  `Region = Northern`) as its value; band options read `Hunger ≤ 20: Starving`. The conflict note is per
  row (a note needs a viewpoint source), not one under the section.
- Help topic `worldEditor.pinsOnPlaceholder`. The manager test's Select mock now names each native
  select after its trigger's `aria-label` (`Pin Kind`, `New Pin Source`, `Pin Source`), and mocks
  `useGameDataOptional` with a stateful host so writes re-render.
