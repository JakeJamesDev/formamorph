# 07: Stat Code and Cards Say Global

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a runner move plus wording and one card change.

## What to build

Stat code runs global stats from the global slot. The `stats` global keeps its name; its docstrings, the Stat Code Guide and hover text say it is the global stats (Q23). A global trait's hover card reads `(global trait)` in its signature and has no Owners row (Q8).

Spec: Q8, Q23, story 10.

## Acceptance criteria

- [ ] Stat code results match the existing suites with the global slot in place
- [ ] Stat code docs and hover text say global stats
- [ ] A global trait's card shows `(global trait)` and no Owners row
- [ ] Four gates green

## Blocked by

- 01
