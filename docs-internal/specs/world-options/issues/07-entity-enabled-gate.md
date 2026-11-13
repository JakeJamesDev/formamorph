# 07: Entity Enabled Gate

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author gives an entity an Enabled gate, and a disabled entity is fully hidden and inert in play.

- World shape: an Enabled gate (Requirement Rows) on entities. No rows = always on (Q7).
- This ticket owns the host gate editor (built from the Requires editor) and gate evaluation inside the resolver; 08 and 09 reuse both.
- A blank owner in an entity's gate reads the entity itself (Q29). The editor warns under the gate when its rows test only that entity's own stats (Q30).
- The resolver evaluates the gate at each turn commit. A disabled entity leaves the scene at the next commit, and any follow ends (Q9).
- A disabled entity is inert: its stats, regen, traits and scripts pause and resume where they paused, using the machinery that pauses a disabled stat (Q23).
- Its position and engine state (start, hold) survive while disabled: the position engine's drop of entities outside the cast, at placement and at save load, skips disabled entities. Re-enabled, it returns where it was (Q38).
- 02 kept the save-load orphan check, the new-game opening fold, roll priming and known-name matching on the authored world, so a disabled entity's item copies and stats survive. Its earlier Code Pins still apply (Q39); pausing its scripts stops new ones.
- Glossary: Enabled in its entity sense. Docs: the wiki's entity pages. Changelog fragment.
- ⚠️ Export-shape change for worlds.

Spec rulings: Q1, Q7, Q8, Q9, Q23, Q29, Q30, Q36, Q38.

## Acceptance criteria

- [x] Resolver tests: the gate on and off for each Condition kind, and the blank owner reading the entity. `inPlayGates.test.ts`: trait, group, stat, item, time and playing-as; blank owner on own stat and trait; Q47 frozen read. The World Option Condition is ticket 04's (not on main yet).
- [x] The parity harness with a failing gate shows the entity in no reader output. `GameViewer.entityEnabledGate.test.tsx` "the readers, through a real gate": presence, every AI request and the script globals, with an on-gate control.
- [x] A `computeTurnCommit` test: the entity leaves at the next commit and its follow ends. `computeTurnCommit.test.ts` "a follower whose Enabled gate failed"; guard bites with the `partWays` line removed.
- [x] Inertness: over several turns while disabled, its stats do not regen and its scripts do not run; re-enabled, values resume. `GameViewer.entityEnabledGate.test.tsx`; bites when the code cast reads the ungated entities.
- [x] A Unique entity disabled mid-routine and re-enabled several turns later is back at its stored position, also across a save and load; the guard bites when the drop no longer skips disabled entities. Same test: position, Start, patrol stop and remaining idle survive; bites with the load hold removed and with the paused engine clock removed.
- [x] The self-lock warning shows for a gate on only the entity's own stats and not for a mixed gate. `EntityManager.enabledGate.test.tsx`; bites with the warning switched off. Linked traits count as own (`inPlayGates.test.ts`).
- [x] Frames: `.scratch/frames/entity-enabled-gate.png`, light and dark, 1280 px. Playwright at a true 1280×800 viewport; dark copy ends in `-dark`.

## Landed

**Not verified**

- The World Option Condition in an entity gate: ticket 04 owns it. Whichever of 04 and 07 lands second wires play's `worldOptionValues` and the world's `options` into the gate input in `useInPlayWorld` (agreed with 04).
- Test Bench gates read the world's start: authored stats, no trait picked, the lens persona (`startGateInput`). Ticket 04's Option picker should feed it too.
- At new game, the opening draw and the first render read gates against the state before the seed, as 02 left it. An entity whose gate holds only under the seeded state is left out of the opening pool; it turns on once the seed commits.
- At load, every gated entity keeps its saved place and engine state unplaced, on or off, because the verdict at load reads the pre-load state. A world that adds a gate after a pre-engine save does not convert that entity's legacy follow.
- Ticket 01's reader test asserted an off entity has no stored position. Q38 reverses that, so the test now asserts the place is held and hidden.

**For you**

- World Editor → an entity → **Presence**: the **Enabled** rows sit above Placement in Simple mode. Check the hint and the self-lock warning read well: `.scratch/world-options-07/frames/entity-enabled-gate.png` and `-dark.png`.
- In play: give an entity a gate on a global stat, then change the stat. It should vanish at once, pause, and come back where it stood.
