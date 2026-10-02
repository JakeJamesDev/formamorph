# 01: Persona traits in stat code

Status: done
Base: 9d26f653
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Fix the reported bug. Stat code gets a `persona` global with `name` and `traits`. `persona.traits['X'].enabled` reads true when the played persona holds an active trait X, and a write switches the persona's own trait (Q1–Q4). The world-level `traits` map is unchanged.

## Acceptance criteria

- [ ] `persona` resolves to the played persona only. The Custom Persona entity is `persona` under None and is not `persona` under a library persona (Q1).
- [ ] `persona.traits` lists only the Bearer's own set, owned or linked. Each entry has `acquired` and `enabled` (Q3).
- [ ] An `enabled` write switches the owned trait through the owned-trait switch path, settles, and logs as a `traits` switch does. It never writes `playerTraits`. An `acquired` write is dropped and reported (Q2).
- [ ] With no persona entity in play, `persona` is an empty entry and `persona.traits['X']?.enabled` doesn't throw (Q4).
- [ ] A world trait and a persona trait with one name stay separate.
- [ ] The surface module, completions and diagnostics know `persona`. The editor test run gives an empty `persona` and reports switches without applying them.
- [ ] Tests at `runStatCodeTurn` cover the reporter's script. The guard is shown to bite by leaving persona traits out of the entries.
- [ ] The changelog line is in In Progress: persona traits now read correctly in stat code.
