# 01: Stat Insert Takes All Five Timings

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a contained generalization of one target and one parser, with existing tests to extend.

## What to build

The help window's Insert reads all five fence tags and writes any of the five timings into the open stat (Q1, Q5). The insert target describes an open script home: a display name for the menu header and an insert that takes any timing. A fence with no tag offers the five timings in the Insert menu. Only the stat panel registers in this ticket. The insert module takes script names (Scripts Leftovers Q6).

## Acceptance criteria

- [ ] The fence parser reads `before`, `after`, `output`, `start` and `switch`, in the fence and on a first line.
- [ ] Insert on a `start` block in the stat panel adds a new At Game Start script and lands on it.
- [ ] An untagged block offers all five timings.
- [ ] The insert unit test, the help window code-insert test and the World Editor code-insert view test cover the new tags.
- [ ] The rider is unchanged.
