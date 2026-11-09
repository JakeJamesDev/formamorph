# 11: Location Presence Tab

Status: ready-for-agent
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

Spec rulings: Q81, Q82.

## Acceptance criteria

- [ ] The Entities picker offers Groups only, and adding or removing one is one undo step.
- [ ] The list shows one line per entity with a place here, with the right reason for a Group, a Start place, a Stay, Wander and Patrol row, and a listed Traversable place. An entity with Traversable = Anywhere is not listed for that reason alone.
- [ ] An entity here for several reasons shows them on one line.
- [ ] The button on a line opens that entity's Routine tab.
- [ ] The Nearby / Far choice on a Connection row and the canvas inspector show the same value after either changes it.
- [ ] Known Here behaves as before; its existing tests pass untouched.
- [ ] The tab's copy follows the Writing Guide. The locations wiki page describes the tab.
- [ ] Frames: `.scratch/frames/location-presence-tab.png`, light and dark, at 1440 px and at 390 px wide.

For you: whether the reason lines read clearly for a busy place such as a tavern.
