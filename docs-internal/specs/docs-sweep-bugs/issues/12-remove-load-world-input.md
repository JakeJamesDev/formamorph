# 12: Remove the Unreachable Load World Input

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: a deletion with one test to remove.

## What to build

The World Editor holds a hidden `#load-world` file input with nothing that opens it, since the World Editor Mobile change removed its button. Ruling Q8: remove the input, its handler and the test that fires the input directly. No Load World button returns.

Spec: Q8, Implementation Decisions "Dead input". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [x] A search of the source finds no `load-world` id, handler or test after the change (grep of `src` found only the `sound-upload-world-bgm` ids; unused imports removed, typecheck green)
- [x] The World Editor still opens a world from the main menu (affected tests green in the gate run)
- [x] No current docs page describes the input (checked); released changelog notes stay as written
- [x] A changelog fragment under Minor / Removed / 🛠️ (`docs-internal/changelog.d/docs-sweep-bugs-12.md`)

## Landed

**Not verified**
- None. The mattpocock code review was skipped: the change is a pure deletion with typecheck, lint and affected tests green.

**For you**
- None.
