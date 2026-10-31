# 05: Trait Body Rows

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A trait can carry a Body row: "set this holder's Body to X while active". A global trait changes the player, and an entity's trait changes that entity (Q24). The Body in force resolver from 01 gains trait overrides. The most recently switched-on active Body-setting trait wins. When it ends, the next one wins. When none is left, the owner's Body falls back to the authored pick and the Default. The save records when each Body-setting trait switched on, so that this order survives a load.

Any Body change goes through the existing settle. That includes a trait switch, a persona change, and a load that finds a different Body. The settle unequips copies in slots the new Body lacks, or above a lowered capacity, most recently equipped first. Effects reverse exactly, and When Unequipped fires. A turn log line names the new Body and the items it unequipped.

If 03 has landed, the Body delete in the Equipment editor also counts trait Body rows and blanks them. If not, 03 picks this up.

Spec: Solution; Implementation Decisions under Data and Body in force; Q11, Q12, Q13, Q23, Q24.

## Acceptance criteria

- [ ] The trait editor can add a Body row that picks a Body
- [ ] An active Body row changes its holder's Body in force, for the player and for an entity
- [ ] Latest-on wins, and ending traits unwind in order back to the authored Body
- [ ] The switch-on order is saved, and a load restores the same Body
- [ ] A lost or shrunk slot unequips the most recently equipped copy first, reverses its effects exactly and fires When Unequipped
- [ ] The turn log shows "Body: \<name\>" with the unequipped items
- [ ] The World Editor Traits wiki page describes the Body row
- [ ] ⚠️ The response that lands this ticket reminds the user of the save shape change
