# 15: Global Trait Scripts In Tree Order

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: one ordering fix in the runner with a guard test.

## What to build

Global traits' scripts run in tree order, the authored order of the world's root traits, as Q38 rules and as the Scripts tab lists them (Q46). Today the runner takes the global part from the acquired list, which is pick order, so a player who picks global traits out of authored order runs their scripts in a different order from the one the tab shows. Entity traits already run in tree order. Ticket 03's review found the gap.

Spec: Q38, Q46.

## Acceptance criteria

- [ ] Two global traits with scripts, picked in reverse authored order, run in authored order; a guard test proves the later-authored script wins a shared write
- [ ] Entity trait order is unchanged; the existing suites pass with no expected value changed
- [ ] Four gates green

## Blocked by

- None (can start immediately)
