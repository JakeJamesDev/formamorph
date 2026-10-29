# 12: Library Persona Timed Traits Survive Load

Status: ready-for-human
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

A running After Consumed trait grant on a played library persona must survive a save load. The load's orphan check for timed traits knows only world and discovered entity ids, so it likely drops the persona's grant on every load (found by reading in the close review; not run).

Spec: Q132.

## Acceptance criteria

- [x] A test loads a save with a running timed trait on a library persona and keeps it, with its end time (`GameplayContext.itemCopies.test.tsx` "keep a running timed trait on a played library persona…", live state and history)
- [x] Reinstating the old id set fails that test (ran it: 1 failed, 8 passed)
- [x] A timed trait whose owner really is gone still drops (same test, `gone` owner, one orphan log line)

## Blocked by

- 06

## Landed

The load's orphan drop now uses `heldEntityIds`, which adds the played library persona. The same set guards Item Copies, so an `entity` copy held by that persona also stays.

**Not verified**

- None.

**For you**

- Play a library persona, consume an item with a timed trait, save, and load: the Inventory tab still lists the effect with its time left.
