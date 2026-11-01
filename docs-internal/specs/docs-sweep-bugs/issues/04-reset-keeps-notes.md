# 04: Reset Keeps Hand-Written Memories

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one handler, one confirmation string, one help topic and one docs page.

## What to build

**Reset All My Changes** in the Memories dialog deletes the memories the player wrote by hand. Ruling Q3: Reset keeps them. Reset clears edits, deletions and pins only. Its confirmation, the Memories help topic and the Memory page say that hand-written memories stay.

Spec: Q3, Implementation Decisions "Memories reset". Evidence: docs-sweep ticket 03, Landed.

## Acceptance criteria

- [x] A component test that adds a hand-written memory, edits and pins an AI memory, then confirms Reset fails today, then passes: the hand-written memory stays, the edit and pin are gone. `MemoryManagerModal.reset.test.tsx` failed before the fix and passes after it.
- [x] The confirmation text says hand-written memories stay, under the Writing Guide. Read against the guide by hand; the copy-sweep skill did not run.
- [x] The Memories help topic and both Memory page passages that say Reset deletes hand-written memories are rewritten; the docs tests are green. `docsCoverage` and the help tests pass.
- [x] A changelog fragment under Minor / Fixed / 👤

## Landed

**Not verified**
- The full test and build gates run once in prepare; only the affected tests ran before it.
- The Reset button's enabled state for a deletion alone or a pin alone has no test.

**For you**
- Split of `hasChanges`: none needed. It gated only Reset, so it now excludes hand-written memories (spec session confirmed).
- Script-pin memories live in the same list as hand-written ones, so Reset keeps them too. Look at whether that is what you want.
