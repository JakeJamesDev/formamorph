# 35: Close Review Gaps In Script Reads

Status: ready-for-agent
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

- [ ] A mounted-game test shows what an At Game Start script reads for a companion and a scheduled entity.
- [ ] A mounted-game test shows what an After the AI script reads for an entity that a Before the AI script moved in the same turn. The landing states the observed value.
- [ ] The Scripts Reference states, per timing, whether an earlier script's entity write is visible, and no sentence contradicts the test.
- [ ] In an After the AI script, an entity whose row changes during the turn reads the `action` that fits its `location`. The test fails with the old minute.
- [ ] On the opening turn, `action` and `location` still read the same moment.
- [ ] The four thin tests above assert what their criteria say, and each fails when its rule is broken.
- [ ] Morphie's page for an entity with a kind has no Locations field, and states Can Also Go when the field is absent.
