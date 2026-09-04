# Placeholder Ownership — Spec

Status: ready-for-agent

Earlier specs: `spec.md` (the resolver and codec, tickets 01–03), `ui-spec.md` (the authoring surfaces,
tickets 04–08). Both are shipped. This spec covers tickets 09–12.

## Problem Statement

An author building a character out of placeholders has to name every piece of it by hand so the pieces stay
apart. Molly's three variants become "Molly (Northern)", "Molly (Southern)", "Molly (Fen-Born)", because the
placeholder list is one flat namespace and nothing in it says a variant belongs to Molly. The structure is
already there — the backend understands that a value which is exactly one chip is a part of the placeholder
holding it — but no surface says so, so the author restates it in prose in every name.

The flat list makes three specific things worse as a world grows:

- **You cannot tell identical names apart.** A world where three variants each hold a `Hair` shows three rows
  reading `Hair`, three reading `Eyes`, three reading `Build`. The palette strip shows them too, so the insert
  menu offers three chips with the same label and no way to choose between them.
- **Everything is public.** A variant that exists only to be one of Molly's three is offered at the top of
  every insert menu, beside the town name and the weather — things an author actually places in world text.
- **Reuse costs a copy.** A world defines `Eye Color` with thirty values. One character should never roll
  blue. Today the only way to say that is a second placeholder holding twenty-nine values, which then drifts
  from the first every time the author adds a colour.

## Solution

Placeholders gain **ownership**, shown as a tree in the same list, and **sharing**, which is a reference to a
placeholder that lives elsewhere and carries its own draw weights.

- A placeholder nested under another is **owned** — private to its owner, hidden from the palette and from the
  root of the insert menu, reachable by drilling into its owner.
- A placeholder referenced by another is **shared** — the row sits in the tree under the holder, and what it
  points at is **the original**, which stays at the top level for anyone else to share.
- A shared row opens the same editor its original does, with the name, the kind and the value list locked. Its
  **draw weights are its own**: benching a value there stops that value rolling for that holder and touches
  nothing else. This is the "thirty eye colours, minus blue, for this character" case, without a copy.
- The values themselves gain stable ids, so a weight — local or shared — survives renaming the value it
  applies to.

## User Stories

1. As a world author, I want to nest one placeholder under another, so that the list shows what belongs to what instead of my naming it in prose.
2. As a world author, I want a nested placeholder to keep its short name, so that I can call Molly's variant "Northern" rather than "Molly (Northern)".
3. As a world author, I want an owned placeholder hidden from the palette strip, so that the strip lists only the things I actually place in world text.
4. As a world author, I want an owned placeholder hidden from the root of the `{` menu, so that typing a name does not offer me three identical rows.
5. As a world author, I want to reach an owned placeholder by drilling into its owner, so that hiding it at the root never puts it out of reach.
6. As a world author, I want to drag a row under another row to make it owned, so that organizing a world is the same gesture organizing locations already is.
7. As a world author, I want dragging a placeholder that other placeholders already hold to make a shared row instead, so that the drag never silently takes it away from them.
8. As a world author, I want a shared row to carry an icon, so that I can see at a glance which rows are mine and which point elsewhere.
9. As a world author, I want to click that icon and land on the original, so that I can edit the real thing without hunting for it in the list.
10. As a world author, I want to create a placeholder from inside another one's value field and have it born owned, so that building a character out of parts never sends me to another tab.
11. As a world author, I want the create row to say it is creating a part of the placeholder I am in, so that I know what I am about to get.
12. As a world author, I want to promote an owned placeholder to the top level, so that a part I decide to reuse can be shared without rebuilding it.
13. As a world author, I want the app to refuse when another placeholder tries to reference something owned, so that "owned" means something rather than describing a row that three others use.
14. As a world author, I want that refusal to offer to promote it, so that the refusal is a fork in the road rather than a wall.
15. As a world author, I want deleting a placeholder to delete what it owns, so that its parts do not outlive the only thing that gave them meaning.
16. As a world author, I want that delete to name what it is about to take, so that I can stop before losing seven placeholders I forgot were under there.
17. As a world author, I want deleting a shared original to leave its rows visibly broken rather than deleting them, so that a reference is never mistaken for a possession.
18. As a world author, I want removing a chip from a value list to release what it pointed at back to the top level, so that where a thing sits and what it belongs to can never disagree.
19. As a world author, I want a shared row to open the same editor as any other placeholder, so that changing a weight is the gesture I already know.
20. As a world author, I want the name, the kind and the value list locked on a shared row, so that I cannot edit the original by accident from a copy of its panel.
21. As a world author, I want the panel to say the values come from the original and the weights are local, so that the locks read as a design rather than as a bug.
22. As a world author, I want to bench a value on a shared row, so that one character never rolls a colour the rest of the world does.
23. As a world author, I want the roll-chance reveal on a shared row to show my local odds, so that the percentages match what will actually happen there.
24. As a world author, I want a value added to the original later to roll in my shared rows too, so that the world I keep growing reaches the characters I already built.
25. As a world author, I want a shared row's own parts to be reachable underneath it, so that I can weight a part of a part without restructuring anything.
26. As a world author, I want to share an Object, so that a bundle of attributes can be reused by four locations without four copies.
27. As a world author, I want a shared Object to show no weight column, so that the panel does not offer a control that could not do anything.
28. As a world author, I want a value benched to zero to disappear from tooltips and read-only pills, so that a preview never advertises something that can never happen.
29. As a world author, I want renaming a value to keep its weight, so that fixing a typo does not silently reshape the odds.
30. As a world author, I want renaming a value to keep every shared row's weight for it, so that a rename in one place does not quietly unbench a value somewhere else.
31. As a world author, I want a value renamed by the find bar to keep its weight too, so that the way I edited it does not change the outcome.
32. As a world author, I want a trait pin picked from the list to survive renaming that value, so that a pin set once keeps meaning what I meant.
33. As a world author, I want to keep pinning a value the list does not carry, so that a trait can still force a shade nobody else rolls.
34. As a world author, I want a running save to keep reading what it rolled, so that renaming a value does not rewrite a story already told.
35. As a world author, I want my existing worlds to open with every chip value shown as a shared row, so that nothing I built changes behaviour the day this lands.
36. As a world author, I want to decide myself which of those become owned, so that the app never guesses at a structure I did not declare.
37. As a world author, I want a placeholder's name qualified when it appears away from its owner, so that a chip in a location description reading "Hair" tells me which Hair.
38. As a world author, I want the tree itself to show bare names, so that four levels of indent do not spend the row on repeating the parent.
39. As a world author, I want the "used by" count on top-level rows, so that I know before I drag whether a placeholder will be taken or shared.
40. As a world author, I want the Test Bench to report a shared row weighting a value its original no longer carries, so that a weight that applies to nothing is visible rather than silent.
41. As a world author, I want the Test Bench to report an owned placeholder its owner no longer holds, so that a part orphaned by a hand-edited file does not simply vanish from play.
42. As a mobile author, I want nesting and un-nesting to work by touch, so that the tree is not a desktop-only feature.

## Implementation Decisions

### Value identity (ticket 09)

- A placeholder's `values` becomes a list of records carrying a stable id and the author's text, in place of a
  list of strings. The id is minted once and never changes; the text is what resolves and what the author
  edits.
- `weights` keys by value id rather than by value text. So does every override introduced in ticket 11.
- Values stay unique by text. Ids buy stability across a rename, not the ability to hold the same word twice —
  the chip row and the multiline boxes keep collapsing a repeat, exactly as they do now.
- The two positional weight remaps are **deleted, not extended**: the editor's own remap and the find bar's
  independent carry both exist only because weights key by text. Ids make a rename a non-event.
- Migration converts a list of strings to a list of records at the world-import boundary, detectable by
  element type so it stays idempotent. Existing weight maps are rekeyed by matching text once, at conversion.
- **Rolls keep storing the resolved text.** A roll is a record of what a playthrough saw, not a reference to a
  definition, so renaming a value leaves running saves reading exactly what they read before. The save
  envelope is unchanged by this spec.
- Trait pins gain an optional value id, used when the pin names a real value and preferred over the text when
  present. The text field stays, because pinning a value the list does not carry is a deliberate feature.

### Ownership (ticket 10)

- A placeholder gains an owner reference: present means owned, absent means top level. Ownership is
  organizational — it decides where a row sits and which surfaces offer it, and the resolver never reads it.
- **The chip value is still what resolves.** Ownership marks which of a holder's chip values are its own; it
  never replaces them. An owned placeholder is always also a chip value of its owner, so removing that value
  releases it to the top level.
- Gestures, each with one meaning:
  - Typing `{` in a value field inserts a **shared** row.
  - Dragging a row under another makes it **owned**. When the target is held by another placeholder or placed
    in world text, the drop makes a shared row instead; the row's icon is the only signal, by decision.
  - Creating a placeholder from inside a value field mints it **owned** by that placeholder. The create row in
    the `{` menu names the owner in that context.
  - A row menu action promotes an owned placeholder to the top level.
- The insert surfaces hide owned placeholders at their root level and offer them one level down, under their
  owner. The drill picker refuses to place a chip at a placeholder owned by something else, and offers to
  promote it instead.
- The list becomes a tree. The hide-referenced-parts filter is removed — collapsing a parent does its job. The
  "used by" hint stays on top-level rows, where it now says how many holders share it.
- Deleting a placeholder deletes what it owns, behind a confirmation naming them. Deleting a shared original
  leaves its rows dangling, drawn with the existing red-`?` treatment and reported by the existing dangling
  rule. References are never cascaded.
- **All tree logic is pure and lives in its own module**, mirroring the location tree exactly: row flattening,
  collapse handling, drop projection, drop application (including the owned-versus-shared decision), the
  delete cascade, and the release-on-value-removal rule. The tree component is an adapter over the shared
  drag-tree scaffold with no logic of its own.
- Names render bare inside the tree, where the indent supplies the context, and qualified with the existing
  `›` separator everywhere the placeholder appears away from its owner: a chip label in world text, a drill
  picker breadcrumb, a Test Bench finding. No second separator enters the app.

### Sharing and weight overrides (ticket 11)

- A shared row carries its own weight map. Semantics are **deny-list**: the map says which values are held
  back here, and a value added to the original afterwards rolls in every shared row. That is the intent — a
  value is added because the world should have it.
- The override lives on the placeholder that holds the shared row, keyed by that row's chip value, then by the
  path walked under it, then by value id. It travels with the placeholder on export and on library absorb, and
  it cannot orphan into a table the placeholder's deletion leaves behind. The placement re-minting that runs
  on duplicate and paste carries the override keys with it.
- Overrides are authorable only along explicit-pick paths. A slot routes through whichever value rolled, so
  the node at a slot path is not fixed at authoring time; the tree only ever shows explicit picks, so the
  ambiguous case is unreachable from the UI. This is a stated boundary, not an accident.
- Shared rows nest all the way down: a shared row's own parts appear under it and each level may carry its own
  override.
- The resolution walk carries the active shared row and the path walked under it, and consults the override
  when it draws — the same shape as the placement chain it already carries for Unique rolls.
- Sharing an Object is allowed. An Object applies every value and never draws, so its panel shows no weights
  and says why.
- The editor panel serves both: a shared row opens it with the name, the kind and the value list locked and
  the weight controls live, writing to the override rather than to the placeholder. The chance reveal reads
  the merged weights, so the percentages are the local ones. The helpers that compute weightedness and
  chances take the effective map rather than reading the placeholder's own.
- A value benched to zero drops out of the describe pass, the chip tooltip and the read-only pill. This is a
  change to existing behaviour: today display ignores weights, so a benched value still shows.

### Vocabulary

- A nested row is **owned** or **shared**. What a shared row points at is **the original**.
- "Part" is retired from UI copy. The drill picker's section headings and every other shipped use are
  rewritten in the new vocabulary, including the create row in the `{` menu.

### Export shape

World JSON changes three times across these tickets — value records, the owner reference, and the override
map. Chip-capable values have never been released, so no published world carries the shapes being replaced.
The version bump and the changelog remain the user's call.

## Testing Decisions

A good test here asserts what the author sees and what the world data becomes, never how the module got
there. Every guard is proven by reinstating its bug once and watching the test fail.

**One new seam**, copied from the established one: the pure placeholder-tree module, tested the way the pure
location-tree module already is — rows, projection and drops driven as data, with no dnd-kit and no layout.
This is the load-bearing choice: it puts the owned-versus-shared decision, the delete cascade and the
release-on-removal rule where they can be tested directly, leaving the tree component with only wiring.

Everything else rides seams that exist:

- The placeholder library's own test file takes value ids, the override lookup inside the walk, and the
  weight-zero display rules. These are pure and belong at the highest seam in the feature.
- The version module's test file takes the value-record conversion and its idempotency.
- The chip vocabulary's test file takes qualified names out of context, owned placeholders hidden from the
  palette, and the data behind the shared row's icon.
- The placeholder manager's test file takes the locked panel, the merged weights and the weight editor
  writing to the override rather than the placeholder.
- The typeahead and drill picker test files take root hiding, the refusal to reference another placeholder's
  owned row, and the create row's wording.
- The rules test file takes the new findings.
- The trait manager's test file takes the pin's value id and the free-text fallback.
- The placeholder-text test file takes benched values dropping out of read-only pills.

The existing placeholder list test loses its hide-parts coverage with the feature; its used-by derivation
moves into the pure tree module and what remains is a wiring test.

Radix and jsdom gotchas apply as documented: portals, the pointer-capture stub, and the toggle-group
clear-on-reclick guard. Live verification runs through the dev router to the Placeholders tab at a realistic
viewport, with static-frame evidence, and covers both themes wherever colour is touched.

## Out of Scope

- Any change to how rolls are stored or read. The save envelope is untouched.
- Enforcing ownership at resolution time. Ownership is organizational; a chip that resolves today resolves
  after this.
- Reporting values that entered an original after a shared row was configured. Deny-list semantics are the
  decision, and the widening is intended.
- Allowing two values in one placeholder to read the same text.
- Replacing weights with an allow-list or a subset selector.
- The nested-brace reading of a slot chip that points at a pool of pools. It is a real display hole and a
  separate effort.
- Weights on a chip placed in world text. Overrides are a value-list concept.
- Version bump and changelog finalization, which stay user-managed. Entries go to the In-Progress section as
  slices land.

## Further Notes

- `saltmarsh-reach.json` in this directory is the fixture the design was tested against: two characters built
  four levels deep out of nested placeholders, places whose names and attributes are placeholders, a weighted
  pool, a paragraph value, and a corner of deliberately broken references that each raise their own Test Bench
  finding. `build-fixture.mjs` regenerates it. Every ticket below should be tried against it by hand before it
  is called done.
- The fixture is what surfaced the problem: its three placeholders named `Hair`, three named `Eyes` and three
  named `Build` are exactly what ownership removes the need for.
- Two risks are accepted rather than solved. The drag has two possible outcomes and only the row's icon says
  which, so a first-time author learns the rule by getting the other one. And value ids are the largest change
  in the spec — they touch the resolver, the codec, every value editor and their tests — while enabling the
  feature rather than being it.
- Ticket order is strict: value ids sit under everything, ownership under sharing, and the Bench rules report
  conditions the first three create.
