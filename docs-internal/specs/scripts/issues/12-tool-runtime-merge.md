# 12: Tool Runtime Merge

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: two sandboxes become one without a byte of Tool behavior changing.

## What to build

Tool scripts run on the shared executor. They keep their own surface, `args`, `world`, `scene` and `placeholders`, their frozen inputs and their text-or-JSON result contract (Q7). The second QuickJS runtime goes away. Every Tool script test passes unchanged.

Spec: Q7.

## Acceptance criteria

- [ ] The Tool script module no longer creates its own runtime; one executor serves stats and Tools
- [ ] Every existing Tool script test passes with no expected value changed
- [ ] A Tool script sees no stat-script variable; a test asserts `stats` is undefined there
- [ ] Four gates green

## Blocked by

- None (can start immediately)
