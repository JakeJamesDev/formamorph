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
- Glossary: Enabled in its entity sense. Docs: the wiki's entity pages. Changelog fragment.
- ⚠️ Export-shape change for worlds.

Spec rulings: Q1, Q7, Q8, Q9, Q23, Q29, Q30.

## Acceptance criteria

- [ ] Resolver tests: the gate on and off for each Condition kind, and the blank owner reading the entity.
- [ ] The parity harness with a failing gate shows the entity in no reader output.
- [ ] A `computeTurnCommit` test: the entity leaves at the next commit and its follow ends.
- [ ] Inertness: over several turns while disabled, its stats do not regen and its scripts do not run; re-enabled, values resume.
- [ ] The self-lock warning shows for a gate on only the entity's own stats and not for a mixed gate.
- [ ] Frames: `.scratch/frames/entity-enabled-gate.png`, light and dark, 1280 px.
