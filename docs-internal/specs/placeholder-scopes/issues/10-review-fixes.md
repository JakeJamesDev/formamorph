# 10 — Review fixes: pins through remint and export, self-pin rule, two UI fixes, cleanups

Status: done
Type: task
Blocked by: 09
Spec: ../spec.md (Scoped placeholders: Duplicate owner, Export · Pins: Value editor, Bench · Roll field colors: Presentation)

Source: two-axis code review of tickets 01–09 (`8bab30a...HEAD`), grilled 2026-09-02. Six units, one
commit each, four gates green on each.

## Problem Statement

An author who duplicates Molly, or exports her card and imports it elsewhere, loses every pin set on
Molly's own placeholder values. A shared placeholder that only a pin reaches never ships with the card.
A value that pins its own placeholder is red in the editor but green in the Bench. The Roll field tip
never says `Molly.Eyes`. A placeholder whose values hold newlines has no pin button. Alongside these,
the review found a dead type alias, two avoided glossary terms, and a handful of code smells.

## Solution

A duplicated or imported owner keeps its value pins, re-aimed at the copy's own placeholders. A card
carries every shared placeholder its chips or pins reach. The Bench names a self-pin as an error. The
Roll field tip reads the same name every other surface does. Both value styles reach pins. The
cleanups land as their own commits.

## User Stories

1. As an author, I want a duplicated entity to keep the pins on its scoped placeholder values, so that the copy behaves like the original.
2. As an author, I want an exported card to carry the pins on its owned placeholder values, so that re-importing it keeps the same behavior.
3. As an author, I want an imported card's pins re-aimed at the card's re-minted placeholders, so that no pin points at an id the world does not hold.
4. As an author, I want a pin's `valueId` re-bound by value text after remint, so that a pin survives its target's values getting fresh ids.
5. As an author, I want an exported card to carry a shared placeholder that only a pin reaches, so that the pin resolves after import.
6. As an author, I want an imported pin whose target is on neither the card nor the world dropped, so that nothing in the editor points at nothing.
7. As an author, I want the Bench to report a value that pins its own placeholder as an error, so that a nonsense pin blocks a green Bench.
8. As an author, I want the self-pin rule to name the placeholder and the value, so that I can find and fix it.
9. As an author, I want the Roll field tip to read `Molly.Eyes` for a chip aimed at Molly's scoped placeholder, so that it matches the palette and letters.
10. As an author, I want the Roll field tip to read `Eyes` on Molly's own placeholder panel, so that the owner is not repeated inside its own surface.
11. As an author, I want a pin button on each value in the multiline value style, so that a placeholder with newline values can pin from the value.
12. As an author, I want the multiline pin button to open the same popover the chip style opens, so that both styles behave the same.
13. As an author, I want placeholder group names to stay find-bar targets, so that I can jump to a folder by name.
14. As an author, I want a chip in an image tag to carry its shared placeholder on the card, so that the tag resolves after import.
15. As a maintainer, I want the dead `TraitPlaceholderPin` alias gone, so that the type file describes what exists.
16. As a maintainer, I want the changelog to say "entity" not "character", so that the wiki uses the glossary term.
17. As a maintainer, I want new TSDoc to say "placeholders" not "defs", so that comments use the glossary term.
18. As a maintainer, I want pin helpers to take `readonly` arrays, so that callers stop copying arrays to satisfy a signature.
19. As a maintainer, I want one pin-list equality helper, so that two identical functions do not drift.
20. As a maintainer, I want the unreachable location order rule and the no-op noun ternary gone, so that the code has no dead branches.
21. As a maintainer, I want one per-kind descriptor table for pin sources, so that adding a source is one row and not seven switches.
22. As a maintainer, I want the chip-naming inputs bundled in one options object, so that a new naming input is one field and not a new positional argument at fifteen call sites.
23. As a release owner, I want the export-shape delta on record as additive with no migration, so that the release step can decide the version bump.

## Implementation Decisions

**Unit 1 — pins through remint and export.**
- The duplicate-ready copy of a placeholder keeps each value's pins. The copy's values get fresh ids as today; the pin's `placeholderId` re-aims through the id map and its `valueId` re-binds by value text with the existing rebind helper, else the id is dropped and the text stays.
- The reference remap that already re-aims chips and owner ids also re-aims pins. The same map serves duplicate and import.
- The shared-placeholder walk for a card or book follows pin targets as well as chips. A shared placeholder reached only through a pin ships in `sharedPlaceholders`.
- At import, a pin whose target placeholder is on neither the card nor the world is dropped. The Bench does not see it.
- `imageTags` stays in the shared-placeholder walk. Spec Export row records it.

**Unit 2 — self-pin Bench rule.**
- One new rule, severity error, in the Placeholders section beside the four shipped pin rules. It flags a value whose pin names its own placeholder. Direct self-pin only; two-step cycles stay with the cycle rule.
- The message names the placeholder and the value. The fix removes the pin.

**Unit 3 — two UI fixes.**
- The Roll field tip uses the shared display-name helper with owners and `relativeTo` the edited placeholder. Same text the palette and letters show.
- The multiline value style gets the same pin entry with count badge the chip style has, opening the same popover.

**Unit 4 — standards cleanups and small refactors.**
- Delete the dead trait pin alias and its comment.
- Changelog: "character" to "entity" in the two In-Progress lines. "Character card" stays.
- New TSDoc: "defs" to "placeholders" or "records".
- Pin helpers and pin editor components take `readonly` arrays; the spread copies go.
- One equality helper replaces the two identical pin-list comparers.
- The unreachable location order rule and the noun ternary go.
- The new eslint-disable on the optional game-data hook stays; it follows the same-file precedent.

**Unit 5 — per-kind descriptor table.**
- One table keyed by pin source kind holds the per-kind pieces the seven switches now repeat: label, read pins, write pins, source key, order. The pin collector, the Bench rules and the Pins section read the table.

**Unit 6 — chip-naming bundle.**
- The chip-naming options object gains the letters input. Every label call site passes one object. No behavior change.

**Bookkeeping.**
- Spec rows edited: Export gains `imageTags` and pin-reached shared placeholders; Groups gains the find-bar line; Bench gains the self-pin rule; ticket 09's "Not done" flips to done.
- Existing changelog In-Progress lines absorb the fixes. No new churn lines.
- Export shape: the fields listed in the spec's Export shape section stay additive. No migration. The release step gets the note.

## Testing Decisions

A good test drives the seam an author or a file would and reads the result. It never asserts on
internal shape. Each guard is proven by putting the bug back and seeing it fail.

- **Card and dictionary file round trip**: export then adopt. Pins on owned values survive with
  targets re-aimed; a pin-reached shared placeholder is carried; a pin to a missing target is gone
  after adopt. Prior art: the existing entity-file and dictionary-file round-trip tests, and the
  scoped-placeholder adopt tests.
- **Bench rules**: one fixture for the self-pin rule, proven quiet when the self-pin is removed. Prior
  art: the four pin rule fixtures.
- **PlaceholderManager render**: the Roll field tip text for an owned placeholder away from and inside
  its owner; the multiline pin button opens the popover. Prior art: the existing Roll field span and
  chip-pin tests in the manager test.
- **placeholderPins module**: the existing rule and section tests are the regression net for the
  descriptor table and the equality helper. No new tests unless a table row has no coverage.
- **placementLetters**: existing label tests pass the bundled object.
- Four gates green per unit. `graphify update .` after each.

## Out of Scope

- Two-step pin cycles in the self-pin rule.
- Keeping a dangling pin and flagging it in the Bench.
- Removing the optional game-data hook's eslint-disable.
- A migration step for the new fields.
- Anything the spec's Out of scope section lists.

## Further Notes

- Commit order is the unit order. Each unit is one repo-style commit.
- The review that produced this ticket: Standards found five hard items and seven judgement smells;
  Spec found three missing, two unasked-for, two wrong. Every hard item and every spec finding is in
  a unit above; the two unasked-for behaviors are kept and recorded in the spec.
