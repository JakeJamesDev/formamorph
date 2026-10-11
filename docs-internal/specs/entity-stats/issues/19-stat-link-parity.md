# 19: Stat Link Parity

Status: done
Blocked by: 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: extends the stat Link model to groups and adds the two trait-Link actions it lacks; the group-Link resolution per bearer is the hard part.

Parent: [Entity Stats spec](../spec.md)

## What to build

Stat Links reach full parity with trait Links. An entity can link a whole Blueprint stat group, and every stat under it reads the Blueprint live. A Blueprint stat or group offers **Link To…** to link it onto chosen entities from the Blueprint side. A stat Link offers **Detach**, which turns it into the entity's own stat with its current values. Rulings Q6, Q7, Q61.

## Acceptance criteria

- [ ] An entity can link a Blueprint stat group; its stats resolve per bearer as single stat Links do, with Overrides per stat.
- [ ] A Blueprint stat added to a linked group reaches every bearer; one removed from it leaves every bearer.
- [ ] **Link To…** on a Blueprint stat or group links it onto the entities picked, skipping any that already link it.
- [ ] **Detach** on a stat Link turns it into an owned stat with the Link's current values under the Blueprint's id, at once with no confirm as trait Detach works (Q69), so the entity's runtime value and any trait change aimed at it carry over.
- [ ] Each action follows the trait Link's behavior and copy for the same action.
- [ ] **Detach** is the only way to make an owned stat from a Blueprint (Q65). Ticket 12 landed Copy Stat; this ticket removes it from the stats **+** menu, the entity Stats mirror, the stat-link helpers and their tests. It reuses that conversion for Detach: the Link becomes the entity's own stat with its current values and runtime value.
- [ ] The unreleased In Progress changelog entry for stat Blueprints is reworded in place to name Detach, not Copy Stat.
- [ ] A Link can override a Blueprint stat's stored starting value.
- [ ] Migration keeps one stat Blueprints group per world and one Link per Blueprint per owner, merging any duplicates.
- [ ] Migration and export round-trip group Links.
- [ ] Response carries the export-shape reminder.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
