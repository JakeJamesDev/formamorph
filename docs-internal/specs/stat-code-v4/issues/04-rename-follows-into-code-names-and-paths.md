# 04: Rename Follows Into Code Names And Paths

Status: ready-for-human
Base: 1f77951e
Blocked by: 02, 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Two extensions to the rename offer that v3 built: derived code-name references and path segments. The detector and the rewrite are in place; this widens what they count. Sonnet at medium effort.

## What to build

Renaming a placeholder changes the code name of every stat and trait whose name carries that chip. The rename offer counts those derived references beside the direct `placeholders` references and rewrites both when accepted, so `stats["Beast Power"]` follows `Beast` becoming `Wolf` and `traits["Beast Fury"]` follows too.

The rename offer also rewrites path forms. A rename of an owner or a holder rewrites that segment in every path that passes through it; a rename of a child rewrites the leaf. Dot and bracket forms, both quote styles, at any depth. Everything else about the offer, the detector, the duplicate rule, and the discard path stays as v3 ticket 10 built it.

## Acceptance criteria

- [x] Renaming placeholder `Beast` to `Wolf` prompts with a count that includes `stats["Beast Power"]` and `traits["Beast Fury"]`; Yes rewrites them to the new code names
- [x] Renaming entity `Molly` rewrites `placeholders.Molly.Hair` and `placeholders["Molly"]["Hair"]` to the new owner segment
- [x] Renaming the child `Hair` under Molly rewrites the leaf and leaves a world-level `placeholders.Hair` alone
- [x] Renaming to a duplicate at the same level prompts nothing
- [x] Discard restores the name and the rewritten code together
- [x] Unit tests on the rewrite for each case; a live check renames an owner in the editor and reads the rewritten path
- [x] Four gates green; graph updated

## Blocked by

- 02 — Paths In The Placeholders Map
- 03 — Trait Code Names

## Comments

**2026-09-12 — built. Gates green, live check done.**

The rewrite reads the tree twice. `planCodeRename` takes the world's placeholder source plus a `subject`
naming which node moved, builds the map once with the subject's old name and once with its new one, and
treats any node whose key differs between the two readings as one every path through it must follow. That
one mechanism answers three separate asks at once: the subject itself, an owner node whose own name carries
the renamed placeholder as a chip (both segments of `placeholders['Town Guard'].Town` move on one rename),
and the derived stat and trait code names, which come from `statCodeName` over the same two lists.

Resolution, not name matching, is what makes the child case correct. Each prefix of a `placeholders` member
chain goes through `walkPlaceholderPath` — the one resolver ticket 02 built — so a rename of Molly's `Hair`
skips a world-level `placeholders.Hair`, carries onto the bare-name fallback where the world has no `Hair`
of its own, and leaves `placeholders.Hair.value` alone where a member won the name.

Three things widened beyond the ticket's letter, each because leaving it out would strand code:

- **Entity and book name fields now report a rename.** An owner opens a path, so `EntityManager` and
  `DictionaryBookManager` wire `useRenameField` the way the stat, trait and placeholder panels do.
- **`renameRootForTarget` became `codeRenameTarget`**, returning the root *and* the subject, so
  find-and-replace goes through the same offer for an entity and a book too. One producer, as before.
- **`codeNameReader` now branches on the subject rather than the root.** An owner's name can carry chips and
  its key is `statCodeName`; only a placeholder's own name reads as written.
- **Find-and-replace measures a duplicate against the same *kind* rather than the same root.** An entity and
  a placeholder now share the `placeholders` root but neither takes the other's name, so the old same-root
  filter would have read one as the other's duplicate. Behavior is unchanged for v3's kinds, where root and
  kind were one to one.

Live check: a world with entity `Molly` owning placeholder `Hair`, and a stat coded
`return placeholders.Molly.Hair.text.length;`. Renaming the entity to `Maud` in the editor asked "The code
of 1 stat names the placeholder “Molly” 1 time. Update it to “Maud”?" and **Update Code** wrote
`return placeholders.Maud.Hair.text.length;`.

No export-shape change.

**Folded in from the review.** Four findings, each with a guard proved by reinstating its bug:

- **A rewrite could rewrite its own output.** The rewrites ran in turn over each other's text, so a moved
  name whose new spelling was another moved name's old spelling ran on:
  `stats.Beast` + `stats.BeastLord` under `Beast` → `BeastLord` gave `stats.BeastLordLord` twice, counted 3.
  Every splice is now measured against the original text and applied in one pass, and the scanner runs once
  per root rather than once per moved name.
- **The dialog called an entity a placeholder.** The noun came from the root. It now comes from the subject,
  so a `CodeRenameSubject` names the kind (`entity` / `dictionary`) rather than a flat `owner`.
- **A find-and-replace on a book never offered.** A search target spells one `book:`, not `dictionary:`.
- **`sourceNaming` evicted the editor's cached path map.** `placeholderPathMap` caches on the list's
  identity, and the owner branch handed it the world's own array under fabricated owners. It now always
  passes a fresh array.

`referenceAt` and `keyOf` were one duplicated string-key reader; there is now one, `keyOf`, and one
`CodeRenameKey` type behind both the flat and the path rewrite.

### Known limit

`(placeholders.Molly).Hair` does not rewrite its leaf — `chainAt` stops at the parenthesis. The top-level
segment still rewrites, so this under-rewrites rather than corrupting.

### Left for later

- **The duplicate rule still measures a placeholder against every name in the world, not its own level.**
  Renaming Molly's `Hair` to `Eyes` while a world-level `Eyes` exists is not a duplicate at that level, but
  the offer stays silent and the code is stranded. The ticket said the duplicate rule stays as v3 built it,
  so this is unchanged rather than introduced. Worth a ticket with the editor's duplicate warning beside it.
