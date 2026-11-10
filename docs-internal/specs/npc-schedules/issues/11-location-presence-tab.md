# 11: Location Presence Tab

Status: ready-for-human
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The location editor's Presence tab keeps its name and changes to fit routines.

- **Entities:** the picker lists Groups only. It adds this place to a Group or removes it.
- **Who comes here:** the per-entity Presence and Movement rows become a read-only list. Each entity that can be at this place gets one line with the reason: a Group; begins here, with the chance when the entity has several Starts; stays, wanders or patrols here, with the time; or can be led here. A button on each line opens that entity's Routine tab.
- **Known Here:** unchanged.
- **Connections:** each Connection row gets the Nearby / Far choice, the same value the canvas inspector sets.

The list is read-only because an Individual's place belongs to a row with a time and an action, and this tab cannot say which row.

Ticket 03 already limits the Entities picker to Groups (Q97). This ticket keeps that and builds the rest.

Spec rulings: Q81, Q82, Q97.

## Acceptance criteria

- [x] The Entities picker offers Groups only, and adding or removing one is one undo step. (`WorldEditor.locationPresence.test.tsx`: picker options, add then undo)
- [x] The list shows one line per entity with a place here, with the right reason for a Group, a Start place, a Stay, Wander and Patrol row, and a listed Traversable place. An entity with Traversable = Anywhere is not listed for that reason alone. (`locationPresenceReasons.test.ts`, guard mutation-tested)
- [x] An entity here for several reasons shows them on one line. (both test files; frames)
- [x] The button on a line opens that entity's Routine tab. (test "opens the entity’s Routine tab from its line")
- [x] The Nearby / Far choice on a Connection row and the canvas inspector show the same value after either changes it. Both read and write `connection.distance` through `withDistance`; row-side set, undo and far-from-either-end tests. The canvas inspector's own tests pass untouched.
- [x] Known Here behaves as before; its existing tests pass untouched.
- [x] The tab's copy follows the Writing Guide. The locations wiki page describes the tab. (Copy sweep by hand against the guide; wiki edited.)
- [x] Frames: `.scratch/frames/location-presence-tab.png`, light and dark, at 1440 px and at 390 px wide. (Playwright, four files with `-light-1440`, `-dark-1440`, `-light-390`, `-dark-390` suffixes)

For you: whether the reason lines read clearly for a busy place such as a tavern.

## Landed

**Not verified**
- The Routine button was driven in jsdom only (the test lands on the entity's Routine tab). I did not click it in a live browser.
- The `help vectors` for the locations page are not rebuilt (`build:help-vectors` is a release step).

**For you**
- Whether the reason lines read clearly for a busy place such as a tavern. Open a location's Presence tab: `.scratch/npc-schedules-11/frames/location-presence-tab-light-1440.png` and the three siblings.
- The route icon on each line: whether it reads as "open Routine". A tooltip names it.
- Hour-based rows show clock times, for example "18:00 – 06:00", the way the Routine tab shows them when a range is off the daypart edges.
