# 06: Routine Edits Keep Their Origin

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An undo of an edit made in the Routine editor does not return to where the author made it. Ticket 04 reproduced this in a real browser and in jsdom: an undo of a Routine editor edit made on a location's Presence tab lands on the Entities section, not on the Presence tab.

The cause, as found: the Routine editor commits each edit as one labeled history step through the world history's batch. The recorder gives a Step no Origin while a batch is open. So no Step from the Routine editor carries an Origin, and a reveal has only the edited field to go on.

This breaks what tickets 04 and 05 built for the Presence tab (Q28, Q31): the reveal that selects the entity on arrival, and the Start it shows, never run for a Routine edit. A Known In edit is not batched and works.

- Find out first why a batched Step gets no Origin. It is written on purpose. Read the history of that line and the tests around it, and state the reason in the landing. Do not remove a guard whose reason is unknown.
- Then make a Step from the Routine editor carry the Origin of the place the author made the edit, without breaking the case the guard exists for.
- The same gap is in the entity panel and the full-screen entity card: check where an undo of a Routine edit lands from each, and state it. Fix it there too when the same change covers it. When it needs a different change, name it in the landing and leave it.
- Other editors that commit through the batch may have the same gap. List them in the landing; do not change their behavior in this ticket.

**Reproduction, from ticket 04** (a real browser at 1280 wide, and jsdom): select an entity with two Starts on a location's Presence tab, delete a row of Start 2, press Start 1, switch the panel to Details, press Undo. The undo lands on the Entities section with the entity's Profile, not on Presence with Start 2. In jsdom the Step's Origin is undefined.

**Already built and unit-tested** (tickets 04 and 05): the reveal selects the entity on arrival and carries the Start of the change, read from the Step's Origin field, else the Start whose data differs. This ticket makes that path run for a Routine edit.

**Left over from ticket 04:** no test shows that the full-screen entity card draws no here-mark. Add one.

Spec rulings: Q15, Q28, Q31, Q32.

## Acceptance criteria

- [ ] The landing states why a batched Step had no Origin, with the commit or test that shows it.
- [ ] A test through the mounted World Editor: edit a routine row under a location's Presence list, change to the Connections tab, undo. The Presence tab is on screen with that entity selected. The test fails on main before the fix.
- [ ] The same test with the edit on the entity's second Start arrives with the second Start on show.
- [ ] Undo of a Routine edit made on the entity panel's Routine tab, from another section, returns to that entity's Routine tab.
- [ ] The case the old guard protected still holds, shown by its existing test or a new one that fails when the guard is removed outright.
- [ ] The landing lists every other caller of the batch and whether its Steps carry an Origin now.
- [ ] A test shows the full-screen entity card draws no here-mark for an entity that has one on the Presence tab.
- [ ] A changelog fragment describes the fix, folded into this effort's unreleased entry where one exists.
