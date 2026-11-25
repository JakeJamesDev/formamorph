# 06: One Wording Everywhere

Status: ready-for-agent
Blocked by: 03, 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Every remaining reader of rule text moves to the clause builder, and the old text code goes (Q5).

- Code cards, update notes, image rule summaries and the Test Bench read a rule in the same words as the Requires field.
- The trait's requirement summary line in the editor uses the same words.
- The Requires field's spoken labels (remove a Condition, delete a row) use the same words.
- The add picker's row labels drop the old wording ("playing as Albus", "any Classes") and name the target alone, since the picker's category already says the kind. Ticket 02 left them.
- The old rule text function and its helpers are deleted once nothing reads them.

Read each surface before the change and list it in the landing notes, so a missed reader shows.

## Acceptance criteria

- [ ] No caller of the old rule text remains, and the old function and its helpers are gone; a search of the source shows none.
- [ ] A code card for a gated trait reads the rule in the new wording.
- [ ] An update note that names a changed rule reads it in the new wording.
- [ ] An image rule's summary and the Test Bench read the rule in the new wording.
- [ ] The Requires field's "Remove …" and "Delete row …" labels read the new wording.
- [ ] The old gate text tests are moved to the builder or removed where ticket 01's tests already cover the case; the landing notes list which.
- [ ] A changelog fragment, folded into ticket 02's entry when that entry is still unreleased.
