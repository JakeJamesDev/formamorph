# 04: Marks For This Location

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The editor under the Presence list shows an entity's whole routine, not only the part at this location. Mark the parts that name this location, so the author sees why the entity is listed.

- **Starts.** Each Start that begins at this location, or has a row that names it, gets a mark on its Start button.
- **Rows.** Each routine row that names this location gets a mark.
- **Can Also Go.** When the list names this location, that entry gets a mark.
- **Opens on the right Start.** On selection the editor shows the first Start that names this location. With none (the entity is here only through Can Also Go), it shows the first Start.
- **Only here.** The Routine editor takes the location to mark from its host. The entity panel's Routine tab and the full-screen entity card pass none and show no mark.

**From ticket 02:** the editor region renders the shared card body, which holds the Routine editor. Pass the location through that body. The selection opens on the entity's first Start today; this ticket changes which Start it opens on.

The mark is a new visual pattern. Follow the Design System, propose the look to the user with frames, and get approval before the landing. The prototype used a small dot on the Start button; it is not approved.

Spec ruling: Q7.

## Acceptance criteria

- [x] For an entity with two Starts where only the second names this location, the second Start button has the mark, the first has none, and the editor opens on the second. `marks the Start that names the location, and opens on it`.
- [x] A Stay, a Wander and a Patrol row that name this location each have the mark; a row that names other locations has none. `marks a Stay, a Wander and a Patrol row…`.
- [x] An entity here only through Can Also Go has the mark on that entry and opens on its first Start. `marks the location in Can Also Go…`.
- [x] The entity panel's Routine tab shows no mark for the same entity (`keeps the Start on show… no mark outside the Presence tab`). The full-screen card passes no location (code read, no test).
- [x] The mark has an accessible name or description, so a screen reader hears it. Role img, name "Names Tavern"; the tests find the marks by it.
- [x] The Design System page lists the mark after the user approves it. User picked the pin in chat; `Here Mark` pattern in `docs/Design-System.md` and the showcase.
- [x] Frames: `.scratch/frames/presence-here-marks-dark.png` and `-light.png`, at 1440 wide, with a marked Start, a marked row and a marked Can Also Go entry in view. Playwright frames at 1440x1350 (variants dot, pin, rail also kept).
- [x] The Locations wiki page says what the mark means. Help vectors are rebuilt for the changed section. A changelog fragment describes the change. `docs/World-Editor-Locations.md`, `build:help-vectors` (4 sections embedded), `docs-internal/changelog.d/presence-rows-04.md`.

For you: approve the mark's look from the frames before the landing.

## Landed

The mark is the map pin (`LocationIcon`), picked by the user from three frames. Q28 and Q29 settled the open-on-Start rule: the Start on show stays when it names the location, else the first that does; it applies to a row click and to a pick kept across a location change, not to Add Entity or an undo reveal. The undo reveal now carries the Start of the change (leftover from ticket 05), read from the Step's Origin field, else the Start whose data differs. Spec review: a pick returning from full screen does not re-seat the Start (outside Q28's two cases).

**Not verified**
- The undo reveal end to end (Q28, Q31). An undo of a Routine editor edit made on the Presence tab never returns to that tab. Reproduction, in a real browser (Playwright, 1280 wide) and in jsdom: select a Warden with two Starts on a location's Presence tab, delete a row of Start 2, press Start 1, switch the panel to Details, press Undo. The undo lands on the Entities tab with Warden's Profile, not on Presence with Start 2. In jsdom the Step's `origin` is `undefined`. Cause: `RoutineTab` commits through `useWorldHistoryStep`, which calls `batch` in `src/contexts/worldRecorder.ts`; `record` drops the Origin while `batching.current` is true (line 210). Ticket 06 owns it (Q32). Covered by unit tests only: `names the Start whose data differs…` and `names the Start the Origin field holds…` in `historyReveal.test.ts`, `shows the Start the undo changed…` in `useEntityPick.test.tsx`.
- The full-screen entity card shows no mark: no test, read from code (the card passes no location).

**For you**
- Select an entity with several Starts on a location's Presence tab: look for the pin on each Start, routine row and Can Also Go entry that names the location, and the editor opening on the first marked Start. Frames: `.scratch/presence-rows-04/frames/presence-here-marks-dark.png`, `.scratch/presence-rows-04/frames/presence-here-marks-light.png`.
- Approve the mark's look from the frames before the landing (done in chat: map pin).
