# 12: Library Persona Timed Traits Survive Load

Status: needs-triage
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

A running After Consumed trait grant on a played library persona must survive a save load. The load's orphan check for timed traits knows only world and discovered entity ids, so it likely drops the persona's grant on every load (found by reading in the close review; not run).

Spec: Q132.

## Acceptance criteria

- [ ] A test loads a save with a running timed trait on a library persona and keeps it, with its end time
- [ ] Reinstating the old id set fails that test
- [ ] A timed trait whose owner really is gone still drops

## Blocked by

- 06
