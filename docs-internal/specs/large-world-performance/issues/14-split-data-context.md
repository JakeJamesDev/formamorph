# 14: Split the Data Context

Status: ready-for-agent
Blocked by: 11, 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: splits the most-consumed context in the app and removes per-keystroke whole-world passes.

## What to build

Components that only call data actions stop re-rendering on every edit. The data context splits stable actions from state. Per-keystroke whole-world passes cache by record identity or run only for changed records: placement letters, Blueprint copy sync, and the advanced-features scan. Re-measure the Test Bench rules pass after typing pauses; move it off the main thread or make it incremental if it blocks over 1 s at 6x. Gameplay never writes the data context.

From ticket 13's profile: after 13, open's worst block (2.0–2.9 s at 6x) is the Test Bench rules on mount (1.06 s), with publish-size measuring serializing the whole world for 0.3 s, plus React mount. Typing a real edit into Name costs 130 s for 26 keys with 21–22 s blocks: tree-row and tooltip re-renders (ticket 11's share) plus the rules after each pause. Publish-size measuring also builds a world-sized string on each pause, raising the heap ~290 MB while typing. This ticket owns the rules, the measuring string, and open's Q1.

Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] A component that reads only actions does not re-render when an entity changes (render-count test).
- [ ] Placement letters and Blueprint copies stay correct after edits (existing tests pass unchanged).
- [ ] Harness `typing` at 6x: no block over 1 s, including the pause after typing.
- [ ] Harness `open` at 6x: no block over 1 s (Q1).
- [ ] Publish-size measuring builds no world-sized string on the main thread; the heap does not rise by world size while typing.
- [ ] Guard bites: merging actions back into state turns the render-count test red.
- [ ] Four gates green.
