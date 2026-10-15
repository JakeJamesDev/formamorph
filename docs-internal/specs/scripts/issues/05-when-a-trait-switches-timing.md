# 05: When A Trait Switches Timing

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a seam on both switch paths, a new `trait` variable, and a gate that reads pre-switch state for one timing.

## What to build

A script with timing When a Trait Switches runs when a trait switches on or off during play. A trait's own script sees its own switches with the trait as `self`, including its own switch-off (Q12, Q13). A stat or world script with this timing runs on every switch and reads `trait`, the trait that switched, with `enabled` giving the direction. Setup picks never fire it. Writes land at once, with the same owner order as every timing.

Spec: Q12, Q13, story 7.

## Acceptance criteria

- [ ] A trait's own switch script runs on its switch-on and its switch-off; a test proves the off run lands a write
- [ ] A world script with this timing runs once per switch with `trait` naming the trait and `enabled` the new state
- [ ] Setup picks and a load fire nothing
- [ ] `trait` appears in autocomplete and the hover cards for this timing only
- [ ] Four gates green

## Blocked by

- 02
