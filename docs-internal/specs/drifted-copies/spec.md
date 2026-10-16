# Spec: Drifted Copies

Status: done
Status note: Closed 2026-10-15. Tickets 01–19 done; last landing bc0baf847. Closed without gates; gates green on main on 2026-10-16.
Spec session: drifted-copies — spec

## Problem Statement

Many jobs in the code are written more than once. A sweep on 2026-10-14 found that byte-for-byte clones are rare (93 clones, 0.46% of lines). The real cost is functional copies: the same job written again with different text. These copies have started to disagree, and each disagreement is a bug that a player or author can hit:

- Deleting an entity, trait, location or placeholder group scrambles the order of the items it held. Deleting a stat group keeps the order.
- **Duplicate** on a location in the filtered list makes a copy that shares the source's Unique-chip rolls. **Duplicate** in the tree does not.
- **Arrange** on the location canvas hangs on a world whose locations form a cycle. Every other walk up the location tree guards against this.
- Five services send `Authorization: Bearer null` when signed out. Others leave the header out. Login drops the server's refusal message, and a 502 page shows a parse error instead of "Login failed".
- A story export can contain the text "Error parsing message. Please check console for details."
- Two embedding timeouts leave their timer running after the embedding wins. Help and the Test Bench have no timeout on embeddings at all.
- A prompt field can get an undo step back to empty when its value arrives after mount.
- Pressing Enter during IME input (Android keyboards) commits a chip mid-word.
- **Load World** with the same file twice does nothing.
- A failed share-code copy is an unhandled rejection with no toast.
- One failed open of the stat-template database stays cached for the whole session.
- Community sort reads bare server timestamps as local time, not UTC.
- Five ID call sites throw over plain-HTTP LAN.

Two larger copy families have no visible bug yet, but every change must be made in each copy:
- The owner-tree drop engine is written twice, once for owned traits and once for owned stats.
- Tree drag-drop (projection, collapsed-row removal, the start of each drop) is written three or four times across groups, locations and placeholders.

## Solution

Each drifted job gets one shared implementation. Every copy calls it. Where the copies disagreed, the shared version takes the correct behavior, so the bug goes away everywhere at once. The two large families become one generic engine each, configured per tree. Real differences stay as parameters, and their output does not change.

## Rulings

Settled with the user on 2026-10-14.

| # | Ruling |
|---|---|
| Q1 | The spec covers the drifted-copy bugs with the copies they live in, the tree drag-drop merge, and the owner-tree engine merge. Services and UI consolidation without a bug is a later effort |
| Q2 | Tests sit at two seams: behavior tests on each new shared helper, and one regression test per bug at its existing public entry, proved to bite by putting the bug back |
| Q3 | IDs go through the project's UUID helper, not direct `crypto.randomUUID()`. A wording change to the agent manual's ID convention is proposed in chat, not made here |
| Q4 | Ticket 13: the generic tree module holds the only projection, collapsed-row and dangling-parent bodies. Each tree keeps its exported names as one-line bindings that pass its parent rule, so callers and tests stay as they are. The dangling-parent helper covers the group, location and placeholder-group lookups and their inline checks. The placeholder chip-holder lookup, the location graph's parent index and the stat group top-level count keep their own rules |
| Q5 | Ticket 15: the parity harness records owned-trait and owned-stat drops and the bind and portable link outputs on the bundled worlds, with each case's outcome kind asserted. Bundled data stays as is. Ticket 18 adds the overlapping-links fixture and its regression case |
| Q6 | With link creation off, a stat drop keeps its current behavior: it returns no result and writes nothing. It is not a `refused` result. The parity harness records it as `none` |
| Q7 | Ticket 19 folds five twin families: owner choices (entity owner choices and Blueprint stat choices), Blueprints subtree ids, placeable group ids with effective placement, links in tree order, and the four "replace an entity's lists, empty means absent" writers. Tickets 16 and 17 already rewrote both drops on the engine, so no other old drop code remains to delete |
| Q8 | Ticket 19 also folds three more writers of the same family into the shared entity-lists writer: the trait-links writer, the trait-links strip and re-add after the owned-traits writer, and the stat play-world strip. The portable writer (generic over portable items) and the placeholder Blueprints group copy stay out |

## User Stories

1. As an author, I want deleting an entity group to put its entities where the group was, so that my list order survives the delete.
2. As an author, I want deleting a trait group to put its traits where the group was, so that the order I set is kept.
3. As an author, I want deleting a location group and a placeholder group to keep sibling order, so that every tree in the editor behaves the same way.
4. As an author, I want deleting an owned group on an entity to keep sibling order, so that entity trees match world trees.
5. As an author, I want **Duplicate** on a location to give the copy its own Unique-chip rolls from any place I start it, so that the copy and the source don't share values.
6. As an author, I want duplicating a dictionary entry or location to put the copy right after the source, the same way everywhere.
7. As an author, I want **Arrange** to finish on a world whose locations hold each other in a loop, so that a malformed world can't freeze the editor.
8. As a signed-out player, I want the app to send no auth header, so that the server treats me as anonymous and not as a bad token.
9. As a player, I want the login screen to show the server's reason for a refusal, so that I know whether my password or my account is the problem.
10. As a player, I want login and password change to say "Login failed" (or the matching fallback) when the server returns an error page, not a parse error.
11. As a player, I want every service to show the server's error text the same way, so that errors read alike across the app.
12. As a player, I want story export to leave out turns that don't parse, so that error text never ends up in my story.
13. As a player, I want the history size estimate, the Turn Card and saved reasoning to read turns that only json5 can parse, so that those turns show as narration and not raw JSON.
14. As a player, I want an embedding call that hangs to time out in every surface, so that Help and the Test Bench don't wait until I press stop.
15. As a player on a long session, I want timeouts to stop their timers when the work finishes, so that the app does not collect running timers.
16. As an author, I want a prompt field to load its value without adding an undo step, so that undo never empties the field I just opened.
17. As a player on Android, I want Enter during IME input to finish the word, not commit the chip.
18. As an author, I want **Load World** to load the same file again when I pick it twice.
19. As a player, I want every file picker to accept the same file twice in a row, so that I can retry an import.
20. As a player, I want a failed share-code copy to show a failure toast, the same as every other copy button.
21. As a player, I want a failed database open to retry on the next use, so that one bad moment doesn't break stat templates for the session.
22. As a player browsing Community, I want sort by date to use UTC for every server timestamp, so that my time zone doesn't reorder listings.
23. As a developer testing from a phone over LAN, I want every ID to come from the UUID helper, so that the app doesn't crash outside a secure context.
24. As an author, I want dragging a trait and dragging a stat between owners to follow one set of rules, so that the two trees don't drift apart.
25. As an author, I want the traits tree and the stats tree to keep their real differences (row id prefixes, cross-owner checks, the hidden Blueprints group, link creation), so that the merge changes nothing I can see.
26. As an author, I want binding owned stats to keep the same link that play keeps when two links overlap, so that the editor and play agree.
27. As an author, I want dragging in the group, location and placeholder trees to project the drop the same way, apart from what each tree allows as a parent.
28. As an author, I want collapsed rows to hide the same way in every tree while I drag.
29. As a developer, I want one generic ancestor walk with a cycle guard, so that a new path-to-root can't hang.
30. As a developer, I want one auth helper for every service, so that a new service gets the signed-out rule and the error shape for free.
31. As a developer, I want one IndexedDB connection helper that resets after a failed open, so that new caches don't copy the bug.
32. As a developer, I want one turn-parse entry, so that a change to the turn format is made in one place.
33. As a developer, I want one bounded-promise helper that clears its timer, so that the timer leak can't come back through a new copy.
34. As a developer, I want one file-pick path that resets its input, so that new pickers get the retry behavior.
35. As a developer, I want one suggestion-key hook, so that IME handling is shared by every typeahead.
36. As a developer, I want one value-sync plugin for the prompt editors, so that the undo rule lives in one place.
37. As a developer, I want each folded copy to keep its existing tests green, so that the merge is proved not to change behavior.

## Implementation Decisions

**Bug fixes by folding copies.** Each item below names the shared implementation and the behavior it takes.

- **Group delete.** One promote-children operation for every group tree. It puts the deleted group's children in its slot and renumbers `order` across the siblings, which is the stat group tree's current behavior. Entity groups, trait groups, owned items, placeholder groups and location groups call it.
- **Duplicate after.** One `duplicateAfter(list, id, clone)` operation. It inserts the copy right after the source. Location duplication always passes a clone that remints placeholders deeply, from the tree and from the list adapter. Dictionary entries use it too.
- **Ancestor walk.** One generic `ancestors(id, parentOf)` with a seen-set. It stops at a cycle. The Arrange depth count, the location and group descendant checks, and the other path-to-root walks in placeholders, Blueprints, location search and stat-code paths use it.
- **Auth requests.** The staff API's `authHeaders` and `unwrap` move to one shared services module, and every service imports them. The header is left out when no token is set. `unwrap` reads the server's error through the existing `responseError`. The world storage service uses the same helper at its hand-built sites, including the two that drop the server message today.
- **AuthService errors.** Every AuthService failure path goes through `responseError` with its own fallback text. A body that isn't JSON falls back to that text and does not throw a parse error.
- **Turn parse.** `parseTurnContent` is the one parser. A `narrationOf(content)` helper builds on it, keeps the regex fallback for truncated content, and returns null when nothing parses. `parseNarration` and its two failure strings go away. Story export, the history estimate, the Turn Card, saved reasoning and the prior-narration corpus read through these two.
- **Bounded promises.** One `withTimeout(promise, ms, fallback)` helper that clears its timer when either side settles. `embedTexts` takes an optional bound and uses it. The two game call sites, Help and the Test Bench pass a bound. The ComfyUI settle wait uses the same helper.
- **Prompt editor value sync.** One exported value-sync plugin with the merge-tag rule: a value the user didn't cause does not become an undo step. Both prompt editors use it, and the duplicate editable plugin goes too.
- **Suggestion keys.** One `useSuggestionKeys` hook for list navigation, Enter, Tab and Escape. It ignores Enter while `isComposing`. Both chip typeaheads use it.
- **File picks.** Every file input reads through the existing `filesFrom`, which resets the input. Load World, the stat-code template import, the tools import, character customization, event images and the profile avatar use it. The stat-code template and tools import share one import routine.
- **Clipboard.** Every copy goes through `copyText` or `copyWithToast`. The local-model copy label resets after its timeout.
- **IndexedDB connection.** One cached-connection helper on top of the existing `idb` module. It clears its cache when an open fails. The embedding, thumbnail, remote image, listing details, world catalog, mascot image, stat template and modal stores use it. The listing details cache drops its own `transactionDone` and uses the shared one. The count-gated LRU prune becomes one helper for the embedding, thumbnail and listing details caches. The byte-gated prune in the remote image cache stays its own.
- **Timestamps.** `toEpoch` parses through `parseServerDate`, so bare timestamps read as UTC.
- **IDs.** The five direct `crypto.randomUUID()` calls use the UUID helper.

**Tree drag-drop merge.**

- One generic projection over a flattened row list. It takes a `canParent(row)` parameter. The group tree passes "groups only". Locations and placeholders allow any row.
- One generic collapsed-row removal. The placeholder version is already generic and becomes the shared one.
- One `planTreeDrop` for the shared head: remove collapsed rows, guard visibility, project, guard cycles, move. It returns the new parent and the moved list. Each tree keeps its own commit step: group drop, location drop, placeholder drop and scoped placeholder drop.
- Dangling-parent resolution becomes one helper. The group, location and placeholder-group versions use it. The location graph's parent index keeps its own rule, since it counts a dangling parent on purpose.

**Owner-tree engine merge.**

- One owner-tree drop engine, configured by an owner adapter. The adapter supplies the item kind's lists, its id scheme and its write-back. Owned traits and owned stats each supply one adapter.
- These shared steps move into the engine: first-node order and root sorting, entity nodes as groups, the blocked check, projection past blocked rows, the owner lookup, the entity write, node drop writes, and the custom-persona root refusal.
- The three "rows below an id" implementations become one.
- These differences stay as adapter choices, and their output does not change:
  - Stat row ids carry an `entity/id` prefix. Trait row ids stay raw.
  - Stats check for duplicate ids and readers when an item crosses owners.
  - Traits keep a hidden empty Blueprints group.
  - With link creation off, a stat drop writes nothing (no result, not a refusal; Q6). A trait moves in as the entity's own.
- The portable and bound-link helpers for traits and stats share one implementation. Links are deduplicated in tree order on both sides. This fixes the stat bind that kept the first link in array order while play keeps the first in tree order.
- The twin helpers fold into the engine: placeable group ids, Blueprints subtree ids, links in tree order, owner choices and "replace an entity's lists, empty means absent".

## Testing Decisions

- A good test drives behavior through a public function and checks the output a caller sees. It does not check private steps or call order.
- Every new shared helper gets behavior tests in its own file: promote children, duplicate after, ancestors, the auth helpers, `narrationOf`, `withTimeout`, the IndexedDB connection helper, LRU prune, `useSuggestionKeys`, the value-sync plugin, the tree projection and `planTreeDrop`, and the owner-tree engine with both adapters.
- Every bug gets one regression test at its existing public entry. Examples: delete a group through the game data actions and check sibling order; duplicate a location through the list adapter and check fresh rolls; Arrange a cyclic world and check that it returns; export a story with a broken turn; load a prompt field and check that undo has nothing to undo.
- Each regression test is proved to bite: put the old code back, see the test fail, then restore it.
- `withTimeout` tests use fake timers. They check that no timer is left pending after either side wins.
- The two merges are behavior-preserving. Existing tests for the trait tree, owned stat tree, group tree, location tree, placeholder tree and placeholder scopes stay green with no edits to their assertions. A parity test runs a fixed set of drops through the old and new engines on bundled worlds and compares the output, then the old engine is removed.
- Prior art: the tree and drop tests next to each tree module, the service tests that stub `fetch`, the jsdom Lexical editor tests for the prompt field, and the game panels test harness for panel-level checks.

## Out of Scope

- Consolidation with no bug attached: the localStorage stores and `keyedStorage`, blob-to-data-URL readers, the world image walk, the embedding worker client, hashing helpers, notice target resolvers, byte formatting, `clamp` copies, library store metadata and Electron `sizeOf`.
- UI consolidation: a wider `ConfirmDialog`, the shared account email and password leaf for the site, the comment editor, pagers, empty states, the memory ledger hook, profile-tab list fetching, the playback bar, instrument headings, multi-select pieces, font selects and the deferred menu action. Several need a new pattern that the user must approve.
- Tree row specs in the editor managers. The trait and stat link rows differ in ways that are a product call.
- AI pipeline items without a confirmed bug: the five `/models` fetches and their missing timeouts, the empty Bearer header on chat requests, the patch-one-turn loop, the chip vocabulary unions, the regex segment splitters, the trait block indent in prompts, and joining inline reasoning across tool rounds.
- The probe harness. It copies app code on purpose.
- Two copies that ticket 19's review found (Q8): the portable writer that replaces links, and the placeholder Blueprints group that copies the trait Blueprints group. These are candidates for a later pass.

## Further Notes

- The full inventory with file and line references is in this session's chat record from 2026-10-14. Line numbers drift, so tickets cite functions, not lines.
- Q3 conflicts with the agent manual's convention line on IDs. The proposed wording goes to the user in chat.
- The group delete rule adopts the stat group tree's behavior as the correct one for every tree. It is the only copy that keeps sibling order.
- The two lower-confidence findings that were not reproduced are left out of the bug list: lost inline reasoning across tool rounds, and the menu focus fight in the bubble menu. The stat bind order is in scope because the owner-tree merge removes the second copy anyway. Its regression test proves the difference first.
- No save or world export shape changes.
