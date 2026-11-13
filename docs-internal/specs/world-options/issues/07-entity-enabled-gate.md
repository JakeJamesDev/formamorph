# 07: Entity Enabled Gate

Status: ready-for-agent
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

- [ ] Resolver tests: the gate on and off for each Condition kind, and the blank owner reading the entity.
- [ ] The parity harness with a failing gate shows the entity in no reader output.
- [ ] A `computeTurnCommit` test: the entity leaves at the next commit and its follow ends.
- [ ] Inertness: over several turns while disabled, its stats do not regen and its scripts do not run; re-enabled, values resume.
- [ ] A Unique entity disabled mid-routine and re-enabled several turns later is back at its stored position, also across a save and load; the guard bites when the drop no longer skips disabled entities.
- [ ] The self-lock warning shows for a gate on only the entity's own stats and not for a mixed gate.
- [ ] Frames: `.scratch/frames/entity-enabled-gate.png`, light and dark, 1280 px.
