# 08: Blueprint Targets Read "This Entity"

Status: done
Blocked by: None
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A Blueprint trait and a Blueprint stat follow one rule in the Requires field (Q37). Today they follow two, and both are wrong on the Blueprint's own field.

**Today, on a Blueprint trait's own Requires field** (Blueprint trait Bold, Blueprint stat Courage, Mira links both):

| Target | Sentence today | Problem |
|---|---|---|
| Blueprint trait Bold, no owner | "Bold is active" | Reads like a Global Trait. In play the Condition reads the entity that links the Blueprint. |
| Blueprint stat Courage | "Mira's Courage is at least 5" | The stat menu offers Courage only under "Mira Stats", so the Condition names Mira. On another entity's Link the gate still reads Mira. |

A Link on an entity is already correct for both kinds: "Mira has Bold" and "Mira's Courage is at least 5", with "you" in the player's view.

**After:**

1. **Subject (Q11, Q37).** On a Blueprint's own field, a Condition with no owner whose target is a Blueprint trait, group or stat reads "This entity": "This entity has Bold", "This entity has a trait in Virtues", "This entity's Courage is at least 5". The subject is the owner token (Q7), so the row does not use the Q31 Owner list.
2. **Stat menu.** On a Blueprint's own field, the stat menu has a section for the Blueprint stats. A pick from it adds the Condition with no owner, as the host's own section does on an entity. The entity sections stay, for a Condition that names one entity on purpose.
3. **Owner token.** On that field, a Blueprint stat's owner token offers the no-owner choice beside the entities that link the stat, so an author can change "Mira's Courage" to "This entity's Courage".
4. **Global targets do not change.** A Global Trait or a Global Stat on the same field keeps the Q25 form: "Paladin is active", "Gold is at least 5".

**Not in this ticket:**

- No change to how a gate is evaluated. A no-owner Condition on a Link already reads the linking entity.
- No rewrite of stored Conditions. One that names Mira keeps Mira.
- No export shape change.

**Notes for the build:**

- The gate input holds stats by scope and does not mark which stats are Blueprint stats. The stat menu and the subject both need that fact; give it one owner.
- A no-owner Blueprint stat Condition on the Blueprint's own field must not show as broken. No scope on that host holds the stat, so check the broken mark.
- Read the subject rule once for the three kinds. Do not add a stat-only branch.

## Acceptance criteria

- [x] On a Blueprint trait's own field, a no-owner Condition on a Blueprint trait, a Blueprint group and a Blueprint stat each read "This entity ..." in the author's view; a clause test covers the three and goes red when the Q25 form wins again. (`traitGates.blueprint.test.ts`; branch disabled, 4 tests went red.)
- [x] On the same field, a Global Trait and a Global Stat keep the Q25 form. (same file)
- [x] The stat menu on that field offers the Blueprint stats in their own section, and a pick writes a Condition with no owner. (`requirementStatSections` test; `RequirementRowsField.blueprint.test.tsx`)
- [x] The owner token of a Blueprint stat Condition on that field offers the no-owner choice, and a pick removes the owner. (component test)
- [x] A no-owner Blueprint stat Condition on that field is not a broken token. (component DOM read; `ruleStates` unresolved false)
- [x] On a Link, the trait sentence and the stat sentence read the same subject in the editor: the entity's name. (clause test, entity host)
- [x] In play, the lock line of a linked trait reads a no-owner Blueprint trait Condition and a no-owner Blueprint stat Condition with the same subject: "you" for the played entity, the entity's name for another. A gate line test covers both. (`gateStates` clause test)
- [ ] The Test Bench reads those two Conditions with the same subject for each entity it checks.
- [x] A location's image rule and an item's image rule keep their subjects ("The player", "The item's owner") for a Blueprint target. (clause test on the item and persona hosts; the rule hosts are untouched)
- [x] The glossary or wiki text changes only where it states the old reading. (no text states it; none changed)
- [x] A changelog fragment.

## Landed

**Not verified**
- Test Bench subject. No bench test was written. The bench reads the same `gateStates` clause (`src/lib/testBench/rules.ts`), which the gate line test covers.

- `TraitRequiresField.test.tsx` pinned the old reading on a Blueprint trait ("Paladin is active", the owner list in the target popover). Its expectations now read "This entity has Paladin" and take the owner from the Owner token, as Q37 says.

**For you**
- In the World Editor, open a Blueprint trait's Requires field. Add a Blueprint stat from "Blueprint Stats" and check the sentence reads "This entity's ...", and the owner list offers "This entity".
