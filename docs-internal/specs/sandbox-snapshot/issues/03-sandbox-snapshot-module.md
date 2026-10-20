# 03: The Sandbox Snapshot Module

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The deep module itself, with play as its first caller. Rulings Q1, Q5, Q11 (the Owner derivation), Q9 (the options table).

## What to build

A player's turn runs every Script through a Sandbox Snapshot and behaves exactly as before. `snapshotOf(state, options?)` takes a `SandboxState` and returns a snapshot. `snapshot.run(unit)` takes one Script unit, derives its Owner from its home, assembles the run options and returns the sandbox result. The turn module keeps its own assembly of per-owner runs, run order, World Tool triggers and replayed writes, and calls `run` per unit. A maintainer can read the assembled options for any Timing and Owner kind in a table test that runs no sandbox engine.

## Acceptance criteria

- [ ] A lib module exports `snapshotOf(state, options?)`, the snapshot's `run(unit)`, and the Owner derivation from a home. `optionsFor(unit)` is exported for tests only and documented as such.
- [ ] A unit names a home (global stat, entity stat, Blueprint group stat, trait on an entity, trait on a Blueprint, world script, World Tool Script), a Timing, and the per-run inputs that Timing needs (sentence, switched trait, call arguments, prompt host).
- [ ] The Owner derivation follows the spec: no Owner for a global stat, world script or World Tool; the entity's cast entry for its stat or trait; an entry of its own with the group's stats for a Blueprint stat; an empty entry for a Blueprint trait. A trait's `self` is its entry as its Owner's map holds it, else not held.
- [ ] The snapshot owns placeholder entries, trait entries, cast entries, dictionaries, places, discovered cast, the Owner entry, `self`, the switched trait and the narration input. The turn module no longer builds any of them.
- [ ] Play's turn module calls `snapshot.run` per unit. The result it reads is the same shape as before.
- [ ] An options table test covers every Timing and every Owner kind above against a small fixture state and asserts the assembled run options, with no sandbox engine run.
- [ ] The parity fixtures stay byte-equal. Every existing turn, World Tool and view test stays green with no assertion change.
- [ ] Four gates green, exit codes read.
