# 11: Remove the Stand-In Player Key

Status: done
Blocked by: 02, 04, 05, 06, 07, 08, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the contract step across the whole codebase.

## What to build

The contract step. The stand-in player key and the read-time fold of the played entity go away once no caller remains (Q2). Code names say global or persona wherever they said player for global scope.

Spec: Q2, stories 26–29.

## Acceptance criteria

- [ ] No reference to the stand-in player key remains
- [ ] No code name uses "player" for global scope
- [ ] Every suite keeps its values
- [ ] Four gates green

## Blocked by

- 02, 04, 05, 06, 07, 08, 09
