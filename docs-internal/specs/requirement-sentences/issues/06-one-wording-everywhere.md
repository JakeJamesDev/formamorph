# 06: One Wording Everywhere

Status: done
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

Two leftovers from ticket 03 ride along:

- A stat target swap keeps a % value and resets a Raw value (Q34). Ticket 03 resets both, in one function.
- A broken on/off World Option value shows as a red token with a warning icon and a tooltip (Q14). Ticket 03 marked only the choice and number values.

Read each surface before the change and list it in the landing notes, so a missed reader shows.

## Acceptance criteria

- [x] No caller of the old rule text remains, and the old function and its helpers are gone; a search of the source shows none. Searched `src/` for `conditionTexts`, `requirementText`, `statTail`, `itemChecks`, `optionNumberTail`, `weatherText`, `openingText`, `ConditionState.text`; typecheck green.
- [x] A code card for a gated trait reads the rule in the new wording. `codeCards.worldItems.test.ts`, `codeCards.opening.test.ts`.
- [x] An update note that names a changed rule reads it in the new wording. `linkedContent.routineList.test.ts`.
- [x] An image rule's summary and the Test Bench read the rule in the new wording. `ruleStates.test.ts`, `traitGates.time.test.ts`, `traitGates.weather.test.ts`, `testBench/rules.test.ts`.
- [x] The Requires field's "Remove …" and "Delete row …" labels read the new wording. Already built from `clauseText` before this ticket; `RequirementRowsField.test.tsx` and `TraitRequiresField.test.tsx` assert them.
- [x] The old gate text tests are moved to the builder or removed where ticket 01's tests already cover the case; the landing notes list which. See Landed.
- [x] A stat target swap from "at least 50%" keeps 50%; from a Raw number it takes the new stat's default. The test goes red when the swap resets both. `RequirementClause.statSwap.test.ts`; red with the % carry removed, green after restore.
- [x] A broken on/off World Option value is a red token with a warning icon and a tooltip. `RequirementRowsField.option.test.tsx` (data-broken, icon, description); the tooltip text comes from the shared `Tip`, not read.
- [x] A changelog fragment, folded into ticket 02's entry when that entry is still unreleased. `changelog.d/requirement-sentences-06.md`, as its own entry under the Requirement Sentences topic (a fragment always lands as a new entry).

## Landed

Surfaces read before the change, each moved to the clause builder:

- Code cards (`codeWorldLookup.ts`): host is the owning entity, or the world.
- Library update notes (`componentUpdates.ts`): through `storedConditionText`, which reads the names a copy stores. An owner-less Condition reads "this entity has X".
- Image rule summaries (`ImageRuleCog.tsx`): same host as the editor (entity, item, persona).
- Test Bench (`testBench/rules.ts`) and the refused-equip note (`inventory/settle.ts`).
- Design-system time reference (`SegmentedMultiSelectReference.tsx`).
- The trait summary line (`gateLine`) and the Requires labels already read clauses.

Old text tests: the `.text` assertions in the gate, option, stat, item, owners, image-visibility and Test Bench tests now assert the clause wording. None was dropped: ticket 01's tests cover the builder, and these pin each reader's result. Picker label tests lost "any" and "playing as".

**Not verified**

- The broken World Option tooltip text on hover: no test reads the `Tip`. The aria-description carries it.
- No visual check of the red token in the browser pane.

**For you**

- A refused equip now reads "X requires that your Strength is at least 5" (`inventory/settle.ts`). I chose "requires that" so the clause fits; check the wording.
- A library update note names an owner-less Condition as "this entity has Futanari". Check it reads well in a Routine row.
- Picker rows now show the bare target ("Class", "Sir Aldric"); check that a group and a trait with similar names stay apart.
