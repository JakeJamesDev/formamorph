# 02: Sentence Field

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The **Requires** field becomes sentences in every host at once (Q1): traits, image rules, entity and location gates, and Routines. The field keeps its props and its data, so no host changes.

**Rows**

- One sentence per Requirement Row, with "or" between rows on its own line, muted, at the row's text size (Q2, Q23).
- Each Condition is one inline box that holds its tokens, its × and the "and" that follows it. A box that does not fit moves to the next line whole (Q22).
- A muted "and…" token ends each sentence and opens the add picker for that row. A muted "or…" line after the last row adds a row. An empty field shows one "Add a requirement…" token (Q10, Q13).
- A small × follows each Condition, always visible (Q9). Removing a row's last Condition removes the row. Each row keeps a delete button.
- The add picker drops its owner page. A new Condition starts with no owner (Q7).

**Tokens for trait, group and persona Conditions**

- Owner: a list token with the Condition's owner choices (Q7, Q11). It is plain text when there is one choice or the field is off-world.
- Verb: a flip token. One click flips Not (Q6).
- Target: a list token with targets of the same kind, plus an **Open** button for the target (Q8, Q17). A swap keeps the owner when the new target allows it, else clears it.
- A broken part is a red token with a warning icon and a tooltip that gives the reason (Q14).
- A Condition that reads global scope has no subject: `[Paladin] [is] active` (Q25). The builder from ticket 01 returns that clause. Such a row has no owner token, so ask the spec session how the author gives it an owner before the first edit.

**Other kinds, for now.** Stat, item, time, weather, Opening and World Option Conditions render the builder's clause as one token whose popover holds today's controls. Tickets 03 and 04 replace that.

This ticket owns the three token types the field uses (flip, list, editor) and the Condition box. Tickets 03 and 04 use them and never make their own.

The duplicate guard stays: an edit that would repeat a Condition in its row, or copy a one-Condition row, is refused, and such list rows are disabled.

The prototype is the reference for layout and behavior, not code to merge (spec, Prototype section). Two open points from the spec's Further Notes belong here; send each to the spec session before the first edit: underline density, and token popovers inside the image rule popover.

## Acceptance criteria

- [x] A row with a trait, a group and a persona Condition reads as the grammar table's sentence; tokens are found by label in a rendered test. `RequirementRowsField.test.tsx`, "reads a trait, a group and a persona Condition…".
- [x] A click on the verb token writes the row with Not flipped, and back. "flips Not on the verb and back"; `TraitRequiresField.test.tsx` Not flip block.
- [x] A pick in the owner token writes the Condition with that owner; the no-owner choice clears it. "writes the owner picked in the owner token…"; Q25 rows take the owner in the target popover ("a Condition with no subject").
- [x] A pick in the target token writes the same kind with the new target; **Open** calls the host's open handler. "swaps the target…", "lists only personas…"; same-kind list mutation-tested.
- [x] "and…" adds to its row, "or…" adds a row, and a new Condition has no owner and shows no owner page. "adds with \"and…\"…". Items keep the owner page until ticket 04 (spec-session ruling).
- [x] × removes one Condition; removing the last one removes the row; the row's delete button removes the row. "removes one Condition with ×…".
- [x] A refused duplicate: the list row is disabled and the flip token is disabled; a test reinstates the bug to prove the guard bites. "the duplicate guard" block; a mutation run (`canReplace` forced true) turned 8 tests red, source restored and checked. No committed test reinstates the bug by itself.
- [x] Each Condition is one box that holds its own "and" (DOM check), and one Playwright run measures that a box which does not fit starts the next line with the "and" left on the line above. "holds each Condition and its own \"and\" in one box"; `e2e/requires-sentences.spec.ts` wrap test.
- [x] A selection in any popover does not move or resize the other choices; measured across every selection of the owner list and the target list. `e2e/requires-sentences.spec.ts`, every owner and target pick, each choice's box read against the list's corner after the zoom-in settles.
- [x] In the image rule popover, a token popover's list scrolls with the wheel. `e2e/requires-sentences.spec.ts`, a real wheel over the target list in the image rule popover.
- [x] The field's test files move to the sentence design; none is deleted without a replacement. Seven `RequirementRowsField.*` files, both `TraitRequiresField` files and the six host tests ported; the old owner-page tests moved to items; the Not-flip tooltip test became the flip token's spoken label.
- [x] Frames `.scratch/frames/requires-sentences-dark-1280.png`, `.scratch/frames/requires-sentences-light-1280.png` and `.scratch/frames/requires-sentences-dark-mobile.png`, on a trait with two rows and a wrapped row. Taken with Playwright.
- [x] The glossary's **Requirement Row** entry names the "and…" and "or…" controls; wiki pages that show the Requires field are updated. `CONTEXT.md`, `World-Editor-Traits.md`, `World-Editor-Entities.md`, `Design-System.md` (Sentence Token pattern).
- [x] A changelog fragment under Major, Added: the Requires field reads as sentences. `docs-internal/changelog.d/requirement-sentences-02.md`.

For you: open a trait's Availability tab in a world with long rules. Do the underlines feel too dense on a row of three or more Conditions?

## Landed

**Not verified**

- The player's lock line, code cards and update notes still use the old wording; tickets 05 and 06 own them. The add picker's row labels ("playing as Albus", "any Classes") are old wording too.
- No Playwright wrap measure on mobile; the mobile frame shows a box wider than the line wrapping inside itself, as the spec allows.
- A library entity's portable self-reference ("self") reads as the entity through `selfBound` in `TraitRequiresField.tsx`; only `EntityEditorModal.traits.test.tsx` covers it.

**For you**

- For you: open a trait's Availability tab in a world with long rules. Do the underlines feel too dense on a row of three or more Conditions?
- Underline density, side by side: `.scratch/requirement-sentences-02/frames/requires-underline-current-dark-1280.png` (today's dotted underline) and `.scratch/requirement-sentences-02/frames/requires-underline-lighter-dark-1280.png` (the proposed muted one, frame only, not committed).
- The sentence frames: `.scratch/requirement-sentences-02/frames/requires-sentences-dark-1280.png`, `.scratch/requirement-sentences-02/frames/requires-sentences-light-1280.png`, `.scratch/requirement-sentences-02/frames/requires-sentences-dark-mobile.png`.
- A popover's choices keep their layout, but the popover follows its token. Picking a global target drops the subject (Q25), so the target token, and its popover on the next open, move left. Try a few swaps on one row and judge whether that reads as a jump.
- A world trait's Condition on an entity's own trait with no owner reads "Tamed is active" (global scope, Q25), so its owner sits in the target popover. Check that this reads right in a world with owned traits.
