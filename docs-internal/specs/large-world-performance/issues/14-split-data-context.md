# 14: Split the Data Context

Status: ready-for-human
Blocked by: 11, 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: splits the most-consumed context in the app and removes per-keystroke whole-world passes.

## What to build

Components that only call data actions stop re-rendering on every edit. The data context splits stable actions from state. Per-keystroke whole-world passes cache by record identity or run only for changed records: placement letters, Blueprint copy sync, and the advanced-features scan. Re-measure the Test Bench rules pass after typing pauses; move it off the main thread or make it incremental if it blocks over 1 s at 6x. Gameplay never writes the data context.

From ticket 13's profile: after 13, open's worst block (2.0–2.9 s at 6x) is the Test Bench rules on mount (1.06 s), with publish-size measuring serializing the whole world for 0.3 s, plus React mount. Typing a real edit into Name costs 130 s for 26 keys with 21–22 s blocks: tree-row and tooltip re-renders (ticket 11's share) plus the rules after each pause. Publish-size measuring also builds a world-sized string on each pause, raising the heap ~290 MB while typing. This ticket owns the rules, the measuring string, and open's Q1.

Ruling (spec session): the first rules pass may run after the World Editor paints. Until it finishes, the Test Bench badge shows no count, never zero.

Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [x] A component that reads only actions does not re-render when an entity changes (render-count test).
- [x] Placement letters and Blueprint copies stay correct after edits (existing tests pass unchanged).
- [x] Harness `typing` at 6x: no block over 1 s, including the pause after typing.
- [x] Harness `open` at 6x: no block over 1 s (Q1).
- [x] Publish-size measuring builds no world-sized string on the main thread; the heap does not rise by world size while typing.
- [x] Guard bites: merging actions back into state turns the render-count test red.
- [x] Four gates green.

## Results

Measured 2026-10-06, production build, 6x CPU, bench world. Before is base `17352d35` (its first run, before the harness changes); after is this branch, three runs on a quiet machine.

| Step | Before | After |
|---|---|---|
| Open: worst block | 1.98 s | 0.78–0.79 s |
| Open: blocked total | 2.7 s | 1.8–1.9 s |
| Typing: latency p50 / p95 | 920 / 1328 ms | 200–216 / 264–288 ms |
| Typing: worst block | 1.44 s | 0.23–0.28 s |
| Typing: heap start → sampled peak | 265 → 847 MB | 245 → 291 MB |
| Typing: heap after GC | 278 MB | 257 MB |

- **Context split:** `useGameDataActions` gives the stable actions their own context. Each action reads the committed state through a ref, so an action-only component never re-renders on an edit.
- **Per-record caches:** placement letters, Blueprint copy targets and the advanced-features scan cache by record, so each pass reads only replaced records.
- **Test Bench off the main thread:** the rules, finding keys and publish size run in a worker. It keeps a world mirror, fed by patches of the records each edit replaced.
  - The first pass posts the whole world once (0.33 s at 6x). Each later pass posts the replaced records only.
  - The worker replies without findings while they stay the same. The bench world has 15,461 findings, and re-marking them on every keystroke cost 3.6 s over 26 keys.
  - Publish size counts each record's JSON once, in the worker. No world-sized string is built on the main thread.
- **Spec-session ruling:** findings arrive after the editor paints. Until the first pass ends, the badge shows no count and the Issues list says Checking….
- **Main finding:** `useEditorSensors` passed new sensor options on each render. dnd-kit then rebuilt its activators, and all 400 tree rows (about 1,400 tooltip triggers) redrew on each keystroke. That was most of the 9 s of typing render time. The fix is in `dragInvariants.ts`, cleared with ticket 12.
- **Load sensitivity:** under load from other sessions, every trace event type slowed about 3.5x, Paint and Layout included. Those runs reached 1.35–1.59 s on open and up to 2.2 s on typing. Base under the same load reached 3.2 s and 20.2 s.
- **The worker's memory cost:** the worker holds its own copy of the world, about world size, outside the main heap.
- **Harness changes:**
  - `EDITOR_SPEED_PROFILE` now also profiles `open` and `typing` and writes `.cpuprofile` files.
  - `EDITOR_SPEED_PROFILE=alloc` samples allocations instead.
  - `EDITOR_SPEED_TASKS` breaks down the three longest tasks of each step.
  - Starting the CPU profiler adds a long task of its own, so read block times from runs without it.
