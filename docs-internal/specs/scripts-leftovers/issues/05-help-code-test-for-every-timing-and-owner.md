# 05: Help Code Test For Every Timing And Owner

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a function-call contract the help AI reads, with timing context to build per owner.

## What to build

The help window's code test runs the code under test in its own timing and on its own owner (Q10). It takes a timing from all five and an owner: a stat, a trait, or the world. During AI Output gets a sample sentence; When a Trait Switches gets a sample switched trait, as the bench check does. With no owner named, it falls back to the open stat, as today.

## Acceptance criteria

- [ ] The offered function accepts all five timings and a stat, trait or world owner.
- [ ] A trait script and a world script each run and return the same JSON result shape as a stat script.
- [ ] During AI Output and When a Trait Switches code runs with its sample context.
- [ ] With no owner named, the test runs on the open stat.
- [ ] Guards fail when the test goes back to the two stat timings.
