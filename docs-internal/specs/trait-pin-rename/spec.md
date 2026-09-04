# Spec: Trait Pins Follow Placeholder Value Renames

Status: ready-for-agent

## Problem Statement

A world author gives a trait a placeholder pin — "while this trait is active, Hair Color is Red." The pin stores the value as a plain string. Later the author renames that value in the placeholder's own value list ("Red" → "Crimson"). Nothing connects the pin to the value, so the pin silently keeps forcing the dead string: the trait still pins "Red", a value the placeholder no longer has, and nothing in the editor says so. The author only notices in play, when a supposedly-pinned trait produces text that no longer matches the world's vocabulary.

## Solution

When an author renames a value in a placeholder's value list, every trait pin that targeted that exact value on that placeholder follows the rename automatically. Custom pins — strings the author typed that were never in the value list, a deliberate and supported feature — are untouched, because a custom string never matches the renamed value. No new UI, no new data shape: renames just stop orphaning pins.

This reuses the identity rule the codebase already established for draw weights, which are also keyed by value string: a same-length change to the value list is a rename or reorder (chip edits keep their position), so entries follow their value.

## User Stories

1. As a world author, I want a trait's placeholder pin to update when I rename the pinned value in the placeholder, so that the trait keeps pinning the value I meant.
2. As a world author, I want to rename a placeholder value without hunting through every trait for pins that referenced it, so that vocabulary cleanup stays a one-field edit.
3. As a world author, I want a pin I typed as a custom string (not from the value list) to never be rewritten by a rename, so that deliberate off-list pins stay exactly what I wrote.
4. As a world author, I want reordering a placeholder's values to leave all pins alone, so that rearranging chips is always safe.
5. As a world author, I want deleting one value and adding a different one to leave pins alone, so that only true renames propagate — a delete-plus-add is not a rename.
6. As a world author, I want a rename to update matching pins across every trait in the world, not just the one I last edited, so that no trait is left behind.
7. As a world author, I want a rename to update multiple pins on the same trait if several target the renamed value, so that propagation is complete within a trait too.
8. As a world author, I want pins on a *different* placeholder that happen to hold the same string to be untouched by the rename, so that propagation is scoped to the placeholder I edited.
9. As a world author, I want renaming a value character-by-character (edits write through on every keystroke) to still carry the pin along the whole chain, so that write-through editing doesn't strand the pin at an intermediate spelling.
10. As a world author editing a placeholder inside a placeholder library item, I want the editor to behave identically even though library items have no traits, so that the shared editing widgets stay uniform.
11. As a player resuming a saved playthrough, I want a trait's pin to reflect the author's latest rename, so that my in-flight game uses the world's current vocabulary.
12. As a player, I want the trait card's own text to resolve with the renamed pin value, so that what the card advertises matches what the trait now does.
13. As a world author, I want the trait editor's pin suggestions and the pin's stored value to stay in agreement after a rename, so that reopening the trait shows a value that still exists in the list.
14. As a world author, I want draw weights and pins to follow the same rename in the same edit, so that one rename never half-applies.
15. As a world author sharing my world on Community Creations, I want the exported world to carry the corrected pins with no shape change, so that downstream copies and older app versions read it exactly as before.

## Implementation Decisions

- **Identity rule (reused, not invented):** a same-length change to a placeholder's value list is treated as a rename/reorder, matching the existing draw-weight remapping. Rename pairs are the positions where the previous value differs from the next value *and* the previous value no longer appears anywhere in the next list. A pure reorder yields no pairs; a delete-plus-add changes the length and yields no pairs.
- **Placement:** the world's placeholder-update path in the game-data context is the single wiring point — it already receives both the previous and next placeholder, and it owns the traits state the sweep must touch. The scoped placeholder store and the placeholder editor component are unchanged, so library-scoped stores (which have no traits) need nothing.
- **The sweep:** for each rename pair, rewrite every trait pin whose placeholder id matches the edited placeholder and whose value equals the old string. All other pins — other placeholders, custom strings, empty rows — pass through untouched.
- **Pure logic extracted:** rename-pair detection and the pin sweep are pure functions living with the other trait-overlay math (the trait-effects module), not inline in the context, mirroring how the rest of that module is structured.
- **No export-shape change:** the pin shape (`placeholderId` + `value` string) and the placeholder shape are unchanged. No migration, no version implication.
- **Saves inherit the fix for free:** chosen traits in a save are refreshed from the world's authoring at load, so renamed pins reach existing playthroughs through the existing refresh path.
- **Accepted degenerate cases (documented, not handled):** renaming a value to a string an unrelated custom pin already used, and renames where the old string still exists elsewhere in the list, are indistinguishable from intent and accepted as-is. Pins already orphaned by past renames cannot be recovered — the link is gone.

## Testing Decisions

- **Two seams, confirmed with the user:**
  - **Context seam** — one test through the game-data context's placeholder update, using its existing test harness: rename a value, assert the matching trait pin followed and an unrelated pin did not. This proves the wiring, the thing a pure-function test cannot.
  - **Pure seam** — direct unit tests on the extracted functions for the edge matrix: plain rename, pure reorder (no pairs), delete-plus-add (no pairs), multiple pins across traits, same-string pin on a different placeholder, custom pin untouched, empty pin rows untouched, rename chain step (old→intermediate carries the pin).
- **Good tests here assert external behavior only:** given a previous and next value list plus a set of traits, the resulting pins — never which helper was called or how pairs are represented internally.
- **Prior art:** the trait-effects module's existing unit tests (same module, same style) and the game-data context's existing provider-harness tests.
- **Guard proof:** per the project test bar, reinstate the bug (skip the sweep) and confirm the context-seam test fails.

## Out of Scope

- **Value ids** (`values` as id+text objects): the true referential fix, rejected — export-shape change, migration, weight rekeying, and custom pins would still need a parallel string form. ~3× the work for the same observable behavior.
- **Placeholder deletion hygiene:** deleting a placeholder leaves pins with a dangling placeholder id (harmless dead rows). Named as adjacent, not fixed here.
- **Session pins:** the player's in-play pin layer also holds values by string; whether an author rename can ever cross it is a separate question.
- **Editor warnings for off-list pin values:** impossible without false-positives on every legitimate custom pin.
- **Recovering already-orphaned pins** in existing worlds.

## Further Notes

- The draw-weight remap helper currently lives inside the placeholder editor component; this spec does not require moving it, but the new pure functions should not be added there — trait knowledge does not belong in the placeholder editor.
- Keystroke-granular write-through is what makes the same-length heuristic sound: each committed edit is one chip operation, so a rename is always observed as a same-length, same-position change.
