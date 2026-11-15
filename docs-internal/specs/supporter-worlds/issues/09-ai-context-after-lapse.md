# 09: Client: AI Context export of a Supporter save after lapse

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one guard reads the loaded save's marker beside the open world's.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in the close review. After a lapse removes a Supporter Copy (R6), its saves stay and can load into a plain world. The in-game AI Context export checks only the open world's marker, so it is enabled while the loaded save holds the removed world's books. The export must also read the loaded save's marker (R17, R23).

## Acceptance criteria

- [x] With a save stamped as a Supporter Copy loaded into a plain world, the in-game AI Context export is disabled with the reason. (`playBlock` test; `GameplayContext.supporterCopy.test.tsx` "exposes the carried marker")
- [x] With a plain save loaded, it stays enabled. (`playBlock` plain-save test; carried marker null after a plain load)
- [x] Each guard is shown to bite by reinstating the bug. (dropped the carried read in `playBlock` and the state mirror: both new tests went red)

## Landed

**Not verified**
- The rendered button in GameViewer: no DOM read. The view only passes `playBlock(...)` to `blockedReason`.

**For you**
- Load a Supporter save into a plain world, open the in-game AI Context window, and check the export button is disabled with its tooltip.
- The Formaquestion AI Context export (`useHelpChat.ts:110`, `FormaquestionAiContext.tsx:137`) also reads only the open world's marker. It may need the same carried marker; not changed here.
