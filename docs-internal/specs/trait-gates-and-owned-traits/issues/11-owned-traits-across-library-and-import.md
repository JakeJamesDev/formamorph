# 11: Owned traits across library and import

Status: ready-for-human
Status note: built in f1854c29 and its review follow-up; notes for later tickets under Comments.
Base: d18020f0
Blocked by: 08 — Enter-world cast pages
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Rationale: serialization rules with the entity file and adoption tests as prior art; the rules are exact and the failure is a silently open gate.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

A library entity's traits come with it into any world. Its requirements on that world's traits rebind by name when the name is unique, and stay locked otherwise. Old worlds and saves behave as before.

## Acceptance criteria

- [ ] An exported entity (entity file, library, character card) keeps a requirement into itself by id, and stores the target's name on a requirement that points out of it, including playing-as. This is an additive entity export change.
- [ ] Import rebinds an outward requirement only when exactly one trait, group, or persona in the new world carries that name. No match or two matches leaves it unresolved, locked, showing the stored name.
- [ ] The library entity editor gains the same Traits tab as the World Editor's, where requirements can point only inside the entity.
- [ ] A library persona's or added character's owned traits appear on its node at enter-world and in play. Enter-world loads each picked library entity's full data on pick and feeds it to the tree; an added character's picks re-key to its fresh copy id. Ticket 08 leaves the tree and picks ready for this.
- [ ] A world or save made before this change loads with every trait behaving as before.
- [ ] Entity file and adoption tests cover: self-owned ids kept, outward names kept, unique rebind, no match, two matches, playing-as rebind, legacy load.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Hand-over (2026-09-27).** The pure seam is `src/lib/portableTraits.ts`: `portableOwnedTraits` (export), `bindOwnedTraits` (id first, then one persona/trait/group by name, else `id: ''`), `adoptOwnedTraits` (remints owned ids only on a collision), `comparableOwnedTraits` (write-back comparison). Off-world, a self "playing as" reads `SELF_ENTITY` (`'self'`).

- **Rulings applied (spec session, Q1–Q4):** id first; self "playing as" follows the copy; no Playing As section in the library picker; an unresolved requirement reads "Requires Paladin" with no hint.
- **Paths that bind:** World Editor add and card import, stored-world add, library sync, the component update dialog, source-check Replace, Enter World (library persona and added characters), and play through `inPlayLibrary` (ticket 09's hook, now taking the world and `addedCharacters(discoveredEntities)`).
- **Library editor:** a top **Traits** tab (`LibraryTraitsEditor`) over the existing tree and trait panel, through a new `TraitStore` context (`src/contexts/TraitStoreContext.ts`); the World Editor still reads the world through it.
- **Decided here:** write-back compares the library form (`shape(copy)`), and outward requirements compare by stored name, so two worlds that bound one name to different ids don't write back in turn. `traitPlacement` is a world-owned field.
- **Not changed:** Enter World binds added characters without reminting, so an unlinked world copy of the same library entity can share owned trait ids with it. A copy reminted on a collision gets fresh ids again on each library update. `contentMatchesSource` on a raw origin-world copy (Link to Library Item) still sees a requirement without a stored name as different from its library form. Owned-trait placeholder pins and chips aren't re-aimed on import (ticket 06's note).

