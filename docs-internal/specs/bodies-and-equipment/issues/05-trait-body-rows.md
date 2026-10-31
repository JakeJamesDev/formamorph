# 05: Trait Body Rows

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A trait can carry a Body row: "set this holder's Body to X while active". A global trait changes the player, and an entity's trait changes that entity (Q24). The Body in force resolver from 01 gains trait overrides. The most recently switched-on active Body-setting trait wins. When it ends, the next one wins. When none is left, the owner's Body falls back to the authored pick and the Default. The save records when each Body-setting trait switched on, so that this order survives a load.

Any Body change goes through the existing settle. That includes a trait switch, a persona change, and a load that finds a different Body. The settle unequips copies in slots the new Body lacks, or above a lowered capacity, most recently equipped first. Effects reverse exactly, and When Unequipped fires. A turn log line names the new Body and the items it unequipped.

If 03 has landed, the Body delete in the Equipment editor also counts trait Body rows and blanks them. If not, 03 picks this up.

Spec: Solution; Implementation Decisions under Data and Body in force; Q11, Q12, Q13, Q23, Q24.

## Acceptance criteria

- [x] The trait editor can add a Body row that picks a Body (`TraitManager.test.tsx` "the Body row": None, then each Body; blank row; remove)
- [x] An active Body row changes its holder's Body in force, for the player and for an entity (`settle.bodies.test.ts`: entity trait, global Hidden trait, persona change)
- [x] Latest-on wins, and ending traits unwind in order back to the authored Body (`settle.bodies.test.ts` "lets the latest switch-on win…"; same-commit ties by tree order for entity and global traits; both guards re-broken and went red)
- [x] The switch-on order is saved, and a load restores the same Body (`settle.bodies.test.ts` "keeps the switch-on order through a save…", history disagreeing with tree order; `GameplayContext.itemCopies.test.tsx` "Body state in a save" file and re-roll round trips)
- [x] A lost or shrunk slot unequips the most recently equipped copy first, reverses its effects exactly and fires When Unequipped (`settle.bodies.test.ts`: Strength back to 5, unequipped events, Dagger before Sword; newest-first guard re-broken and went red)
- [x] The turn log shows "Body: \<name\>" with the unequipped items (`settle.bodies.test.ts` bodyLog lines; GameViewer writes `bodyLog` on every non-load commit)
- [x] The World Editor Traits wiki page describes the Body row (`docs/World-Editor-Traits.md` "Body" section, panel table, conflict note; help topic `worldEditor.traitBody`)
- [x] ⚠️ The response that lands this ticket reminds the user of the save shape change (landing report)

## Landed

**Not verified**
- The Body row in a live World Editor at a real viewport. The preview's `__fmDev.editWorld` hook no longer exists, so no stored world opened; the jsdom test covers the row.
- When Unequipped scripts in a live game. The settle's events are tested; GameViewer hands them to `runItemEvents` on trait toggles, persona changes and the turn settle (the turn settle now waits for them).

**For you**
- Trait toggles, persona changes and the turn settle now run the When Unequipped scripts of every copy the settle unequips. Before, those paths dropped requirement unequips' events too. Check an item script fires when a requirement fails after a trait toggle.
- A switch or item script that turns a Body trait on between turns writes the traits without a settle (as it already does for requirement unequips). The Body changes at the next turn's settle. Decide whether that path should settle at once.
- At new game, a starting trait's Body unequips seeded gear silently: no log line and no script (game-start rule). Ticket 04's equipped placements meet this first.
