# 10 — Placed chips read by label on every editor surface

Status: done
Type: task
Blocked by: 09
Spec: ../followup-spec.md (issue 5, letters and surfaces)

## Task

- A pure `placementLetters(world | item)` index: walks entities (list order), locations, traits, stats,
  dictionaries, then placeholder values; assigns A, B, … AA to Unique placements per placeholder id.
  Memoized on the world in `GameDataContext` and computed over the item alone in the library modals.
- Display text for a chip: author label if set; else `Name (A)` for Unique, `Name` for World.
- Surfaces: `VariableChip` (in-field, every chip field including panel value fields and reference
  chips), `PlaceholderText` pill (tree rows, item list, keyword tags), `describePlaceholders` and its
  callers (dropdowns, canvas, modal titles, filenames, library cards, community listings, bench lens).
  Plain text keeps braces: `The {Tavern Name (A)} Inn`.
- Tooltip: placeholder name, mode, then the value list. Deleted placeholder: red `?` plus the label.
- Editor search matches label, placeholder name and values.

## Acceptance

- Two entities named by the same Unique placeholder read `Town Name (A)` and `Town Name (B)` in the
  tree, the canvas, the location dropdown and the bench picker.
- Removing the first renumbers the second to (A).
- A World chip shows no letter anywhere.
- The 300-character dropdown option from the grilling screenshot reads as one short labeled name.

## Answer

Shipped. `lib/placementLetters.ts` is the pure core: `placementLetters(texts)` letters every Unique
placement id in text order, one A–Z–AA sequence per placeholder id; `worldPlacementTexts(world)` is the
document walk (entities, locations and traits **as their trees list them**, then trait groups, stats,
dictionaries, the overview's prompt fields, then placeholder values — trait groups and the overview are
additions to the ticket's list so no chip that primes in play goes unlettered); `worldPlacementLetters` /
`entityPlacementLetters` / `dictionaryPlacementLetters` bundle walk and lettering; `chipPathName` is the one
root-plus-path join the vocabulary and the plain-text form share; `chipPlaceholderNames` lets the tab list
filter find a labeled chip by its placeholder's name; `entityPlacementTexts` / `dictionaryPlacementTexts` walk a
library item alone; `placementDisplayName(token, name, letters)` is label → `Name (A)` → `Name`, with
`Name (Unique)` where no index covers the placement; `labelPlaceholders(text, placeholders, letters)` is
the plain-text form (lone chip bare, embedded chip braced, gone placeholder `?` plus its label).

`PlacementLettersContext` carries the index. `GameDataContext` computes it per edit and keeps the instance
while nothing changed (`useStablePlacementLetters`), so a keystroke that adds no chip rebuilds no chip
vocabulary; both library modals compute it over their item. `ChipVocabulary` gains `display?(token)`;
`label` stays the bare name (rename, remove, mode heading). `hint` now leads with the mode, so a tooltip
reads `Town Name — Unique · a|b|c`. `TokenChip`, the `PlaceholderText` pill, keyword/alias chips and
every `describePlaceholders` name site (dropdowns, canvas, connections, stat selects, modal titles, export
labels and filenames, library card and community listing names, Bench pickers, Bench finding items, the
stat-code check) read through it. Card and listing *descriptions* keep the value preview: a blurb is
prose, and a braced label inside a paragraph reads worse than the values do.

Search: `findMatches` walks segments and a chip is a hit when its label, its qualified placeholder name or
any value holds the query; the hit spans the token and carries `chip`. `replaceAll` counts and skips chip
hits; the find bar says so on Replace and Replace All; `navigateToMatch` rings the chip through
`revealEditorChip`, whose selector now also reaches a pill inside a chip-list entry (pills carry the
token attribute). The results line names a chip-named item by its label too. The tab list filter matches
the label or the values.

Live (probe world, dev3): Entities tree `Town Name (A)`, `Town Name (B)`, `Town Name`, `Hometown`; the
in-field chip and the Export button read `Town Name (A)`; the entity's location dropdown reads
`The {Tavern Name (A)} Inn` and `Town Name (D)`; the location list, the canvas and the Bench location
picker agree; deleting the first entity re-read the second as `(A)`; find `hometown` → 1 / 1 with the chip
ringed and the breadcrumb reading `Hometown`; `bellmoor` → 5 (four chips and the value's own field).
