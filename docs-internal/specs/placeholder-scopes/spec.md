# Placeholder Scopes, Groups, Stat Text, Roll Colors, Pins — Spec

Status: done
Status note: 2026-09-02, ten tickets under issues/01–10; all ten resolved.

Six asks, grilled into one plan. Builds on `docs-internal/specs/placeholder-ux-polish/spec.md`,
`followup-spec.md` and `docs-internal/specs/hierarchical-placeholders/ownership-spec.md`.

## Problem Statement

- An entity card or dictionary file carries the shared defs its chips use. Import merges them by
  name + values or mints copies. A placeholder that exists only for Molly has no home but the world
  list, so every export and import pays the merge.
- Placeholders have no folders. Entities do.
- Stat `description` and descriptor `description` are plain inputs. They never resolve a chip.
- The Roll field shows one gray string. Nothing says which placeholder produced which words.
- Traits are the only pin source. A location, a stat band, or a rolled value cannot pin anything.
- Pins are edited only at the source. A placeholder has no view of who pins it.

## Decisions

### Scoped placeholders (owners)

| Point | Decision |
|---|---|
| Owners | Entities and dictionary **books**. Locations, traits, stats do not own. |
| Storage | `Entity.placeholders` and `Dictionary.placeholders` are live in-world. `World.placeholders` holds shared ones only. One combined view feeds every reader (resolve, prime, letters, palette, search, Bench). |
| Placeholder-owned inside a scope | Allowed. `Placeholder.ownerId` still names a placeholder. The record lives in the same owner list as its holder. |
| Name | Stored name is `Eyes`. Display outside the owner is `Molly.Eyes`. Inside the owner's own fields it is `Eyes`. Rename of the owner updates every surface. |
| Reach | Placeable anywhere in the world. The owner's fields offer its scoped placeholders first. Elsewhere the `{` typeahead and palette list them as `Molly.Eyes`. |
| Deleted owner | Chips elsewhere read the red `?` in the editor and `""` in play, same as a deleted placeholder. |
| Duplicate owner | The copy re-mints its placeholders and remaps the copy's chips and its values' pins. A pin at something outside the copied list — a shared placeholder — is left exactly as written. |
| Moves | Drag a shared placeholder onto an owner node to scope it. Drag a scoped one to root or a group to share it. Ids are kept, so no chip re-aims. |
| Tab display | The Placeholders tab shows a derived owner node per entity or book that owns any. Owner nodes are not folders: no rename, no delete, not draggable. Order: groups and root rows, then entities in tree order, then books. |
| Panel display | Entity and dictionary panels get a Placeholders section bound to the item's own list, the same `PlaceholderEditor` the library modals mount. |
| Export | A card or dictionary file carries `placeholders` = owned (as-is, pins kept) and `sharedPlaceholders` = the shared placeholders its texts, its owned values' chips and its owned values' **pins** reach (off-world only). An entity's `imageTags` is one of those texts. Import keeps owned with fresh ids + remap, re-aims each value pin through the same map and re-binds its `valueId` by value text, drops a pin whose placeholder is on neither the card nor the world, absorbs shared by name + values as today, clears `sharedPlaceholders`. |
| Old files | A card or dictionary written before this reads its `placeholders` as **owned**. No marker, no second path. Behavior change on old files: they stop merging with the world's copy. |
| Library | The modals already bind to the item's list. Unchanged, except the tab is now the same section the world panel shows. |

### Groups

| Point | Decision |
|---|---|
| Shape | `World.placeholderGroups: PlaceholderGroup[]` `{ id, name, parentId, order? }` + `Placeholder.groupId?`. Mirrors `EntityGroup`. |
| Tree | Nestable. Horizontal drag sets depth, same adapter as `EntityTree`. Add Group is the same `FolderPlus` popover item, advanced mode. |
| Members | Shared placeholders only. A scoped placeholder cannot join a group. An owned (placeholder-owned) row stays under its holder. |
| Name | Plain text, not chip-capable. Editor-only, never sent to the AI. |
| Palette + typeahead | A heading per group. Ungrouped shared placeholders under no heading, first. Owner-scoped placeholders under an owner heading (`Molly`). |
| Portability | World-only. `groupId` is dropped at card/dictionary export. |
| Find bar | A group's name is a find-bar target like any other named record, so a folder can be jumped to and renamed from the bar. |

### Stat text

| Point | Decision |
|---|---|
| Fields | `Stat.description` and every `StatDescriptor.description`. |
| Editor | Single-line `ChipInput` via `PlaceholderNameField`, like stat name. Rows keep their height. World / Unique pop-out, placement letters and search hits all apply. |
| Runtime | `resolveStatNames` resolves both fields. Stat description reaches the AI (`buildStatContext` meaning piece). Descriptor text reaches the AI (status piece) and the player (`StatRow`). |
| Letters walk | Stats walk `name`, `description`, then each descriptor `description` in threshold order. |
| Search | `worldSearch` marks both `chipCapable: true`. |

### Roll field colors

| Point | Decision |
|---|---|
| Rule | One color per **direct chip** of the drawn value. A span of text produced by a chip paints in that chip's placeholder accent. Literal text of the drawn value stays plain. |
| Lone-chip value | Northern's whole roll is one span in Northern's color. Nested chips are not distinguished. |
| Scope | The Roll field only. The Preview tab keeps its current tinting. |
| Presentation | The same `<mark>` tint the Preview pane uses, with the placeholder name as tooltip. |
| Mechanism | `drawPlaceholderOnce` gains a structured sibling returning `{ text, placeholderId? }[]` spans. The string form stays for existing callers. |

### Pins

Four sources. One pin shape everywhere: `PlaceholderPin { placeholderId, value, valueId? }`
(the rename of today's `TraitPlaceholderPin`, which is gone).

| Source | Field | Active while |
|---|---|---|
| Trait | `Trait.placeholderPins` | The trait is chosen and not disabled (as today). |
| Location | `GameLocation.placeholderPins` | The location is current. Released on leaving. No inheritance through `parentId`. |
| Stat descriptor | `StatDescriptor.placeholderPins` | `activeDescriptor(stat, value)` returns that band for the current player stat value. A disabled stat contributes none. |
| Placeholder value | `PlaceholderValue.pins` | The placeholder's **effective world-scope value** (roll masked by its own pins) is that value. A placeholder with any value pins always gets a world roll primed. |

| Point | Decision |
|---|---|
| Precedence | descriptor > location > trait > value pin. Within a source, existing rules hold (lowest trait wins). |
| Chains | Value pins resolve to a fixed point: apply, re-read effective values, repeat until stable. A cycle stops at the first repeat and the Bench reports it. |
| Pre-game | Pickers layer in descriptor pins from starting values after trait effects, and location pins from a picked starting location, beside draft trait pins. |
| Init | The starting-location log line and opening cue resolve with all four sources, pins not yet in state (`resolveWith`). |
| Author draws | The Roll field and the Preview tab apply the drawn values' pins inside the same draw. |
| Masking | A pin masks World and Unique chips and never overwrites the stored roll (as today). |
| Gating | Every pin UI is advanced-mode only, including the Placeholder Pins section. |
| Location editor | A Placeholder Pins section like the trait editor's. |
| Descriptor editor | A pin button on each descriptor row with a count badge. Opens a popover holding the shared pin rows. |
| Value editor | A pin button on each value with a count badge, in both value styles — the chip row and the multiline boxes. Same popover. |
| Placeholder Pins section | Derived by walking all four sources. Data stays on the source. Add = pick kind, pick source, pick value. Edit = change value or re-aim source. Remove = delete from source. Rows sorted by precedence, source named on each (`Trait: Sworn`, `Location: Fen`, `Hunger ≤ 20`, `Region = Northern`). |
| Conflicts | One shared `ConflictNote` in every pin editor and the Pins section. Names every competing pin from any source and states which wins. |
| Bench | Rules for cross-source conflict, value-pin cycle, a pin naming a missing value, a broken pin on any source, and a value that pins its own placeholder (error, fixable by removing the pin). A two-step loop stays with the cycle rule. |

## Export shape (user reminder)

World: `placeholderGroups`, `Placeholder.groupId`, in-world `Entity.placeholders` and
`Dictionary.placeholders`, `GameLocation.placeholderPins`, `StatDescriptor.placeholderPins`,
`PlaceholderValue.pins`. Card and dictionary files: `placeholders` changes meaning to owned,
`sharedPlaceholders` added, plus `PlaceholderValue.pins`. A card now also carries a shared placeholder
that only a value pin reaches, so `sharedPlaceholders` can hold one no chip places — still the same
field, no new one. Every field here is additive and no migration is needed. Older builds ignore the new
fields and show raw chips in stat text. Version bump and any migration are the user's call at release.

## Out of scope

- Locations, traits, stats as owners. Entry-level dictionary ownership.
- Pins on Unique placements. Pins key by placeholder id.
- Keying World rolls by shared row (open boundary in `ownership-spec.md`).
- Nested-producer colors in the Preview tab or Bench texts.
- Pin inheritance through location `parentId`.

## Verification

- Pure modules first: combined view, owner lookup, scope moves, group tree, structured draw, pin
  collection with precedence and fixed point. Mutation-proven per the `test-bar` skill.
- Editor surfaces: `PlaceholderManager.test.tsx`, `StatManager` / `StatDescriptorsSection`,
  `LocationManager`, `EntityTree`-style tests for the placeholder tree and owner nodes.
- Runtime: `GamePanels.test.tsx` cases for a resolved stat description and descriptor, a location pin
  applied on `changeLocation` and released on the next, a descriptor pin flipping with the number.
- Live: import the stress-test world through the file input, walk one scoped placeholder from create
  to card export to re-import, roll an Object and read the spans.

## Tickets

| # | Ticket | Blocked by |
|---|---|---|
| 01 | Combined placeholder view + scoped storage | — |
| 02 | Owner nodes, panel sections, scope moves, display prefix, export/import | 01 |
| 03 | Placeholder groups | 02 |
| 04 | Stat description and descriptor chip inputs | 01 |
| 05 | Roll field per-chip spans | 01 |
| 06 | Pin core: four sources, precedence, fixed point, runtime + pre-game | 01 |
| 07 | Pin editors: shared rows, location, descriptor, value, shared ConflictNote | 06 |
| 08 | Placeholder Pins section | 07 |
| 09 | Bench rules for pins across sources | 06 |
| 10 | Review fixes: pins through remint and export, self-pin rule, two UI fixes, cleanups | 09 |
