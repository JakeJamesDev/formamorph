# 35: Close Review Gaps In Script Reads

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The close review of 2026-11-11 read tickets 26 to 34 against the spec. Three gaps are in what a script reads during a turn. Four criteria are ticked on tests that prove less than they say. Close them all here.

**Gap 1. At Game Start has no test.** Ticket 29 left its criterion "Before the AI and At Game Start scripts read the same values as before this ticket" unticked. Before the AI is covered. At Game Start relies on the turn placement being cleared when the turn starts. Add a test through the mounted game: an At Game Start script reads `location`, `following` and `present` for a companion and a scheduled entity, and gets the opening placement.

**Gap 2. The Scripts Reference contradicts the code on earlier scripts' moves.** It says prompts and scripts in the same turn read the entities as they were before a script's `move()`. The review traced that an After the AI script reads the entity writes of Before the AI scripts and Tool calls as applied, because it reads the Inventory pass's placement (Q226). Nobody ran it. Reproduce it first: a Before the AI script moves an entity, and an After the AI script in the same turn reads its `location`. The code stands (Q232). Correct the Reference so that it says, per timing, whether an earlier script's entity write is visible, and keep the test.

**Gap 3. `action` and `location` read different moments in an After the AI script.** `location` reads the place before the end-of-turn placement. `action` and `held` read the routine at the end-of-turn minute. An entity whose row changes during the turn reads the new row's action at the old place. Make `action` and `held` read the minute their placement belongs to (Q231): the minute the turn began for the usual After read, and the end-of-turn minute only in the two cases where the placement itself is the end-of-turn one (the opening turn, and a suggested move the player has not taken, Q226). Add a test that crosses a row boundary inside one turn.

**Thin tests to make real**

- Ticket 28: the sample Tool snapshot test asserts an empty placement, because its cast has no kind. Give it a cast with a kind and assert the placed entity.
- Ticket 30: the read-only test checks the values and the reported paths for the entity fields only. Assert the report for a write to an exit's `distance` and `oneWay` too.
- Ticket 33: "the Custom Persona's list is unchanged" is tested on an entity with no kind. Test a real Custom Persona.
- Ticket 31: Morphie's page for an entity with a kind still prints the derived Locations field, which no screen shows for it, and prints nothing for Can Also Go when the field is absent, where the engine reads an empty list. Drop the first for an entity with a kind; print the second as the screen shows an empty list.

No world or save shape changes. Do not rebuild the help vectors unless you change a wiki page; if you do, rebuild once at the end and give the stale count before and after.

Spec rulings: Q231, Q232, Q220, Q225, Q226.

## Acceptance criteria

- [x] A mounted-game test shows what an At Game Start script reads for a companion and a scheduled entity. (`GameViewer.scriptReadMoments` "reads the opening placement": Pip at Village, following, present there; Cora at Hut, present there only.)
- [x] A mounted-game test shows what an After the AI script reads for an entity that a Before the AI script moved in the same turn. The landing states the observed value. (Observed: `location` "Well", `held` true, in `locations.Well.present`; see Landed.)
- [x] The Scripts Reference states, per timing, whether an earlier script's entity write is visible, and no sentence contradicts the test. (New table under Where Each Timing Reads Entities; each row run in "reads the entity writes of every earlier script" and "…an At Game Start script moved".)
- [x] In an After the AI script, an entity whose row changes during the turn reads the `action` that fits its `location`. The test fails with the old minute. (Q234: the no-location test fails with the end minute; the located and opening tests fail with the start minute.)
- [x] On the opening turn, `action` and `location` still read the same moment. ("…on the opening turn, across a row change": Well and wander at 11:00.)
- [x] The four thin tests above assert what their criteria say, and each fails when its rule is broken. (Each reinstated: sample cast without kind, exit wrap off, Custom Persona read as a world persona, both page rules reverted.)
- [x] Morphie's page for an entity with a kind has no Locations field, and states Can Also Go when the field is absent. (`worldIndex.test` two new cases.)

## Landed

Probe on a mounted game (Q234's evidence): a turn from 09:00 to 12:00 with the player at Village. A Before script moved Dan to the Well. Cora's 10:00 row sends her from the Hut to the Well.

| Script | Reads |
|---|---|
| Before the AI | 09:00; Cora at Hut, `action` stay |
| After the AI | 12:00; Cora at Well, `action` wander; Dan at Well, `held` true, in `present` |

Per timing, for a Before the AI `move()` (all observed): the same script reads the old place; the next Before script reads the move; During AI Output and a Tool call read the old place; After reads the move. An After script's move reaches the next After script. On the opening turn, Before does not read an At Game Start move; After does.

Corrected stale claims of ticket 29 (not edited there): the After batch reads the end-of-turn placement in every turn that begins at a location, not only the opening turn and an untaken suggested move. The Reference said the opposite; it now follows the code.

Code changes beyond the tests:
- `GameViewer.tsx`: a turn that begins with no location reads `action`/`held` at the turn's start minute (Q234). A turn that begins with none and ends at a place with a pull is keyed the same (review finding); no test covers that pull case.
- `statCodeExecutor.ts`: a write to any field of an exit (`name`, `hint`, `distance`, `oneWay`) is now reported read-only. It was dropped silently, so ticket 30's criterion never held for exits; its old test passed only because the place had no exits.
- `sampleScene.ts`: the sample cast has a kind and one Start at its old place (spec ruling). No sample chip text or pinned test output changed; the Tool tester with no world open now places the cast, so `present` lists them.
- `worldIndex.ts`: the two Morphie page rules.
- Help vectors: 12 stale before (3 Scripts Reference sections from this ticket, 9 Avatars, Stats and Traits sections already stale on main), 0 after.

Not verified: nothing left unticked.

For you:
- No changelog fragment: each change refines an unreleased Routines entry. Say if you want a line.
