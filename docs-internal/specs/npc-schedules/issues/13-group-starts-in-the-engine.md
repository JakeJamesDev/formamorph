# 13: Group Starts In The Engine

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The world shape and the save shape change. Say so in the landing report (export-shape reminder).

## What to build

A Group stops being a plain place list. It holds Starts in the same shape as an Individual, and in play every Start runs at the same time as its own presence, each on its own rows. The Group is still one entity: one set of stats, inventory and memory.

- **World shape:** a Group holds Starts, rows and Traversable in the Individual's shape. Its `locations` list becomes derived from its Starts and rows, as it already is for an Individual. A Group ignores a Start's weight, Strict and Traversable.
- **Position engine:** each Start of a Group resolves its own row, Wander pick and Patrol stop. No Start roll, follow state, hold or pull applies to a Group. A Group is at a place when any presence is there.
- **Save shape:** a Group saves one record per Start id (position, idle end, patrol stop index, current row id). A Start added to the world after the save begins at its place. A record whose Start is gone is dropped.
- **Play readers:** everything that asks "who is at this place" counts a Group once, even with two presences there. That covers the scene roster, the Entities chip and its nearby section, the script `locations` entry and the Test Bench.
- **Editor stand-in:** the Group's place control in the Routine tab keeps working. Adding a place adds a Start with no rows there; removing a place removes the Starts that begin there. The last Start can't be removed. Ticket 14 replaces this control.
- **One helper** adds a Start to a Group and removes a Group's Starts at a place. Tickets 14, 15 and 16 use it; this ticket owns it.
- **Bundled worlds and dev fixtures** that hold a Group move to the new form in their files. Write no load-time compat for the unreleased place-list form.

Out of this ticket: the released-world migration rule (ticket 18), Player's Starting Location (ticket 17), and any new editor UI.

Spec rulings: Q130, Q131, Q132, Q133, Q140, Q141. The spec's "World shape: entities", "Position engine" and "Save shape" sections are the contract.

## Acceptance criteria

- [x] A Group with two Starts on different rows has a presence at each row's place at the same clock time, shown by position engine tests on a fixture world. `positionEngine.test.ts` › Groups › runs every Start at once, each on its own row.
- [x] Each presence keeps its own Wander idle and Patrol stop across turns and across a save and load. Groups › keeps each presence on its own Wander idle and Patrol stop; `GameplayContext.positions.test.tsx` › round-trips each presence.
- [x] Two presences in one place list the Group once in the scene roster, the Entities chip and the script `locations` entry. `presence.test.ts` (Look Around), `entityPresence.test.ts` › entitiesInPlay (the chip and Test Bench read through it), `sandboxSnapshot.locations.test.ts`, `positionPlay.test.ts` (opening cast).
- [x] A Group is never pulled, never follows, and gets no location request; script `.follow()` and `.move()` on a Group do nothing. Groups › is never pulled…; `narrationReading.test.ts` › never pulls a Group; `entityFollowing.test.ts` › never asks a Group, leaves a Group where its presences stand.
- [x] A save made before a Start was added loads with the new presence at its Start's place, and drops the record of a deleted Start. `GameplayContext.positions.test.tsx` › begins a Start added after the save…
- [x] Two Starts of one Group at the same place are accepted and both run. Groups › runs two Starts at the same place.
- [x] The Routine tab's place control for a Group adds and removes Starts, and undo restores a removed Start. `RoutineTab.test.tsx` › a Group's place list.
- [x] No bundled world or fixture still stores a Group as a place list, and no code reads that form. Seven bundled worlds (40 Groups) and `devFixtures.ts` converted; test fixtures swept by grep.
- [x] The world format doc and the glossary describe a Group's Starts. `docs/WorldFormat.md`, `CONTEXT.md`.

## Landed

**Not verified**

- Nothing in the live preview. Every criterion is covered by tests; no UI pattern changed beyond the stand-in's behavior.

**For you**

- Export shape: a Group in the world `.json` now holds `starts` (its `locations` is derived), and the save `.json` gains `groupStates` (one record per Start: position, row id, last run, idle end, Patrol stop). Both unreleased.
- A library entity added to a world remaps a Group's Starts and rows through the location map. An Individual's Start places are still not remapped there; that gap is a follow-up (Q158).
- No changelog entry: nothing a player or author sees changes until ticket 14 gives a Group its routine editor.
- Follow-up: the Test Bench opening pool (`testBench/opening.ts`) reads raw `world.entities`, so a Group (and, as before, an Individual) counts at every routine place there. Play and the Bench's AI Context go through the placed cast.
