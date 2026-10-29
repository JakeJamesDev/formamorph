# 14: Runtime Item Description

Status: needs-triage
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

The spec defines a runtime item as a name and a short description, created by the pass. `RuntimeItem.description` exists, but the pass never fills it. The pass schema and text format gain an optional short description on a gain that creates a runtime item; the panel and the narration chip show it.

Spec: the Runtime item definition; Q24, Q36, Q56. A prompt change: ships with probe numbers.

## Acceptance criteria

- [ ] The pass fills the description when it creates a runtime item; an existing runtime item keeps its first description
- [ ] The panel and the inventory chip show it
- [ ] Probe numbers on cloud and Cydonia with in-batch controls: operation accuracy does not drop

## Blocked by

- 09
