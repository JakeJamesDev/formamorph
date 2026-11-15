# 09: Client: AI Context export of a Supporter save after lapse

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one guard reads the loaded save's marker beside the open world's.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in the close review. After a lapse removes a Supporter Copy (R6), its saves stay and can load into a plain world. The in-game AI Context export checks only the open world's marker, so it is enabled while the loaded save holds the removed world's books. The export must also read the loaded save's marker (R17, R23).

## Acceptance criteria

- [ ] With a save stamped as a Supporter Copy loaded into a plain world, the in-game AI Context export is disabled with the reason.
- [ ] With a plain save loaded, it stays enabled.
- [ ] Each guard is shown to bite by reinstating the bug.
