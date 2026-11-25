# 09: One Owner Model for Traits, Groups and Stats

Status: ready-for-agent
Blocked by: None
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The Requires field answers three questions about a trait, a group and a stat. Today traits and groups answer them with one set of code and stats with another. The two sets drifted four times in one day. This ticket gives the three kinds one model, so one change moves all three.

| Question | Traits and groups today | Stats today |
|---|---|---|
| Which pages does the add menu have? | The trait options, grouped by the option's home | The stat sections |
| Which owner does a pick store? | Decided in the field, by the page | The owner of the stat's section |
| Who is in a Condition's owner list? | The option's own owner list | Derived from the stat sections |

**The model.** One module answers, for a host and a target kind:

1. **Pages**, in this order (Q41, Q42):
   - the host's own entity, when the host is an entity (no owner on a pick);
   - **Global**: the world's own traits, groups or stats (no owner);
   - **Blueprints**: the Blueprint ones (no owner), first when the host is a Blueprint;
   - **Persona**: what an entity that can be played holds (the pick reads "The player");
   - each other entity: what it holds, own and linked (the pick names that entity).
2. **The owner a pick stores**: the page decides it, by the list above. A location's rule and an item's rule keep their own first page ("Persona", "Item Owner") and their current rule.
3. **The owner list of a stored Condition** (Q43): the owners that hold the target, each once. The no-owner choice is in the list only when the host's own reading is valid: the host entity holds the target, or the target is global, or the host is a Blueprint and the target is a Blueprint one. A stored Condition that has no owner still shows its current choice.

**Visible changes:**

- The trait and group menus say **Global** where they said **World** (Q41). The path on a trait row follows.
- The trait and group menus get a **Persona** page (Q42).
- A trait's owner list no longer offers the field's own entity when that entity does not hold the trait (Q43). Example from a real world: on Roxanne's field, "Trainer has Female" for the Trainer's own trait offers "The player" and "Trainer", not "Roxanne".
- The field's own entity shows once in an owner list, never as both the no-owner choice and a named owner.

**Keep:**

- Q37 to Q40: the sentences, the Blueprints page, the linked rows on an entity's page, the red tokens.
- The swap list holds each target once (Q17).
- Off-world, only the host's own page shows.
- No change to how a gate is evaluated, and no export shape change.

**Notes for the build:**

- The field renders from plain props. Choose one shape for the page list and one for the owner list, and pass them from every host: the trait panel, the image rule editor, and the test harness. Remove the two old shapes; do not keep them beside the new one.
- "Blueprint-ness" has two definitions and three carriers today (a close review finding). The model owns the one definition.
- Many field tests click a row by its name or read "World". Change what the ruling changes; do not weaken a check.
- Run typecheck before the gates.

## Acceptance criteria

- [ ] One module builds the pages and the owner list for traits, groups and stats; the field has no branch on the target's kind for either.
- [ ] The add menu's pages have the same names and the same order for Traits, Any Trait in a Group, and Stats, on an entity's field, a Global Trait's field and a Blueprint's own field. One test reads the three lists and compares them.
- [ ] Both menus say Global; no menu says World.
- [ ] The trait menu has a Persona page, and a pick from it reads "The player has ...".
- [ ] A pick from each page stores the owner the table gives, for a trait and for a stat, with one test per page.
- [ ] A trait's and a stat's owner list hold the same owners for the same holders; the no-owner choice follows Q43; the host's entity shows once.
- [ ] A stored no-owner Condition on a target the host does not hold still shows its current choice selected.
- [ ] A location's rule and an item's rule keep their sentences and their first page.
- [ ] The swap list still holds each target once.
- [ ] The two old shapes are gone from the field's props.
- [ ] A changelog fragment for the visible changes.
