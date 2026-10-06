# 14: Split the Data Context

Status: ready-for-agent
Blocked by: 11, 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: splits the most-consumed context in the app and removes per-keystroke whole-world passes.

## What to build

Components that only call data actions stop re-rendering on every edit. The data context splits stable actions from state. Per-keystroke whole-world passes cache by record identity or run only for changed records: placement letters, Blueprint copy sync, and the advanced-features scan. Re-measure the Test Bench rules pass after typing pauses; move it off the main thread or make it incremental if it blocks over 1 s at 6x. Gameplay never writes the data context. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] A component that reads only actions does not re-render when an entity changes (render-count test).
- [ ] Placement letters and Blueprint copies stay correct after edits (existing tests pass unchanged).
- [ ] Harness `typing` at 6x: no block over 1 s, including the pause after typing.
- [ ] Guard bites: merging actions back into state turns the render-count test red.
- [ ] Four gates green.
