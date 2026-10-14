# 06: Pins on the Global Slot

Status: done
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one fallback and one ranking to move.

## What to build

Placeholder pins fall back to the global slot where they fell back to the stand-in key, and global stays first in the pin ranking (Q20). Global traits and persona traits pin as separate owners. Placeholder tree names stay.

Spec: Q20.

## Acceptance criteria

- [ ] A pin with no entity owner resolves through the global slot
- [ ] Global traits and persona traits pin as separate owners
- [ ] Existing pin suites keep their values
- [ ] Four gates green

## Blocked by

- 01, 04
