# 06: Routine Edits Keep Their Origin

Status: ready-for-human
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

- [x] The landing states why a batched Step had no Origin, with the commit or test that shows it. See Landed.
- [x] A test through the mounted World Editor: edit a routine row under a location's Presence list, change to the Connections tab, undo. The Presence tab is on screen with that entity selected. The test fails on main before the fix. `WorldEditor.routineOrigin.test.tsx` "returns to the Presence tab with the entity selected"; red without the opt-in (lands on Entities).
- [x] The same test with the edit on the entity's second Start arrives with the second Start on show. "shows the second Start when the edit was on it": both Starts name the location, Start 1 is pressed before undo; red without the opt-in.
- [x] Undo of a Routine edit made on the entity panel's Routine tab, from another section, returns to that entity's Routine tab. "returns to that entity's Routine tab from another section"; red without the opt-in (lands on Profile).
- [x] The case the old guard protected still holds, shown by its existing test or a new one that fails when the guard is removed outright. `WorldEditor.optimize.test.tsx` "reveals what it touched on undo, not the tab the author ran it from"; observed red ("Media" for "Overview") with the guard removed.
- [x] The landing lists every other caller of the batch and whether its Steps carry an Origin now. See Landed.
- [x] A test shows the full-screen entity card draws no here-mark for an entity that has one on the Presence tab. `WorldEditor.presenceMarks.test.tsx` "draws no mark on the full-screen entity card"; observed red with a `hereMark` passed to the card.
- [x] A changelog fragment describes the fix, folded into this effort's unreleased entry where one exists. The Presence half was already claimed by the unreleased Entity Presence entry, so the fragment adds only the Routine tab case, under Routine Tab.

## Landed

**Why a batched Step had no Origin.** Commit c9add5c4f ("Reveal the Origin Tab After Undo", history-reveal-origin spec story 25 and Q4) set it for Optimize Images: that batch spans the world, so its undo reveals what it touched, not the tab it ran from. Its test is `WorldEditor.optimize.test.tsx` "reveals what it touched on undo, not the tab the author ran it from". Every later batch caller inherited the rule.

**The fix.** `batch` takes `{ keepOrigin: true }`, and `useWorldHistoryStep` passes it through. The Routine editor opts in. The recorder counts open world-wide batches, so a Routine edit made during an Optimize Images run still records no Origin.

**Where an undo of a Routine editor edit lands now** (one change, in `RoutineTab`, covers all three hosts):
- Presence tab: that location's Presence tab, entity selected, Start of the change on show. The Start comes from the data-diff fallback: a row delete records no `starts/<id>` field.
- Entity panel Routine tab: that entity's Routine tab.
- Full-screen entity card: Ctrl+Z in full screen belongs to the canvas, so the world undo comes after full screen closes. It lands on the Presence tab the card opened over, entity selected. Full screen does not reopen.

**Other batch callers (Q33), unchanged, no Origin:**
- Optimize Images (`WorldEditor.tsx`): no Origin, on purpose.
- Full-screen canvas map routine edits (`LocationCanvas.tsx`, `applyRoutineEdit`): no Origin. From a jsdom run: a map click on a picked entity, full screen closed, Connections tab, undo, lands on the Entities section with the entity's Profile tab.
- The Custom Persona edit that also clears the legacy VRM fallback (`EntityFields.tsx`, `useSpendFallback`): no Origin. Its plain edits keep theirs.
- `beginGroup` callers (Move Routine Time in `DayStrip.tsx`, `useMediaItemActions.ts`, the provider's group) never dropped the Origin.

**Not verified:** none.

**For you:**
- The canvas map routine edits land on the entity's Profile, not where they were made. A follow-up could opt them in.
- Check the new Routine Tab changelog line beside the Entity Presence undo line in 🚧 In Progress.
