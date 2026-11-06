# 12: Import Cost

Status: ready-for-human
Blocked by: 08, 09, 10, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Production import changes must keep behavior and bundles intact while cutting a cost that is spread widely.

Parent: [Test Sweep spec](../spec.md)

## What to build

Collection time falls through import changes (Q15). The ledger names the imports that cost most across test files. Split barrels and defer heavy imports where behavior stays the same, and tune setup files and environments where evidence supports it. Isolation stays on. Features can run again from this step, so check parallel sessions before each shared edit.

Rulings: Q1, Q15.

## Acceptance criteria

- [x] Collection, setup and environment times before and after are recorded, from runs under comparable load. Three alternating pairs on the fixed sample, CPU per run (Q-B); see Results.
- [x] Each production import change is listed with what it saves. One production change, the lazy calendar; the setup split is test-only. See Results.
- [x] The app and site bundle sizes before and after are recorded, and `site`'s boundary still holds. Both builds measured; `site/bundleBoundary.test.ts` 18 of 18 green.

## Results

Measured 2026-11-06 on the fixed sample: every 12th test file, 152 files (77 jsdom, 75 node), including 10 that reach `DateTimeField`. 4 workers, before and after alternated by swapping the changed sources between runs. Worker seconds summed across files.

| Pair | CPU before / after | Collect s | Setup s | Environment s | Wall s |
|---|---|---|---|---|---|
| 1 | 22% / 28% | 80.0 → 71.1 | 14.8 → 9.6 | 26.3 → 27.4 | 73.4 → 72.7 |
| 2 | 27% / 32% | 86.6 → 74.5 | 15.1 → 10.5 | 26.9 → 30.3 | 76.6 → 74.9 |
| 3 | 48% / 41% | 99.0 → 80.8 | 16.9 → 11.0 | 31.8 → 31.5 | 88.4 → 80.8 |
| **Median** | | **86.6 → 74.5 (−14%)** | **15.1 → 10.5 (−30%)** | 26.9 → 30.3 (noise) | 76.6 → 74.9 |

Environment time has no change in it; its spread follows machine load. The spec session ruled these runs light enough to need no AFK window (Q6, Q-B).

A test that opens the calendar now pays its import inside the test body rather than at collect: `ChangelogEntryDialog` "submits the three fields" went 0.6 → 1.8 s. The saving is in the files that render the field and never open it.

### What each change saves

| Change | Kind | Saves |
|---|---|---|
| `src/test/setup.ts` loads Testing Library and jest-dom only under a DOM | Test setup | Node setup 7.2 → 1.9 s per 75 files, about 70 ms a file. About 810 node-environment files in the suite: ~57 worker-s. |
| `DateTimeField` loads `react-day-picker` from `date-calendar.tsx` when a pointer or focus reaches the date button | Production import | ~1.4 s of collect per test file that reaches it; 166 files reach it statically: ~230 worker-s. Sample jsdom collect fell 8–19 s per run. |

**The calendar, owner ruling "Keep it" (Q-A).** `react-day-picker` imports the whole `date-fns` barrel, about 250 files.

- Cold load of the chunk after the app booted, 10 cache-busted loads each: web (`vite preview`) median 5.6 ms, max 9.6 ms; desktop (Electron `app://`, probe) median 2.4 ms, max 4.0 ms. Over a network, add one round trip for 20 KB gzip JS and 1.6 KB CSS.
- Hover → 158 ms → click on a bundled build, read with a MutationObserver: the chunk finished 3 ms after the hover, and the grid rendered at the click with no placeholder in the DOM.
- A click with no hover first shows a calendar-sized placeholder for about 326 ms. This is React's minimum fallback hold. A real mouse always hovers first; keyboard focus and touch both load it before the press.
- `React.lazy` suspends on its first render even with the module loaded. So once the preload resolves, the field renders the loaded component directly. `date-time-field.lazy.test.tsx` guards that and the preload. Each test went red when its bug was reinstated.

**Ruled out:**

- Vitest's `deps.optimizer` loads two `@codemirror/state` copies and breaks the editor tests, with no collect gain.
- `stripMarkdown` (remark, ~87 ms a file, 655 files) and the CodeMirror parser in `src/lib` (27 ms a file, 1,254 files): both are called synchronously. Cutting `traitMoveReaders` → `statCodeRename` spares only 96 files.
- `@base-ui/react/tooltip` (~110 ms a file, 688 files) and `streamdown` (~100 ms, 540 files) render on mount, so deferring them changes what shows.

### Bundle sizes

| Build | Before | After |
|---|---|---|
| App JS, all chunks | 56,706,663 B raw, 31,836,368 gzip, 364 files | 56,706,210 raw, 31,837,279 gzip, 368 files |
| App main `index` chunk | 6,184,817 raw, 1,907,477 gzip | 6,022,874 raw, 1,855,430 gzip (−162 KB, −52 KB gzip) |
| App calendar chunk | in `index` | 68,535 JS (20,010 gzip) + 7,969 CSS |
| Site JS, all chunks | 13,673,913 raw, 3,110,318 gzip, 332 files | 13,674,929 raw, 3,110,788 gzip, 334 files |

The main chunk's 162 KB went to three chunks: the calendar (68.5 KB) and two shared chunks the calendar also imports, `select` (71.1 KB) and `utils` (20.9 KB). The app fetches both shared chunks at start, so first load is unchanged. The site already reached the date field through its community pages; the calendar splits there too.

**Separable.** The calendar is `date-calendar.tsx`, the `date-time-field.tsx` hunk, `date-time-field.lazy.test.tsx` and `src/test/calendar.ts` with its three callers. Reverting those files undoes it. The `setup.ts` change does not depend on it.

## Landed

**Not verified**

- Whole-suite before and after: Q-B left them to close-spec's Reference Run.
- Desktop load time came from a probe that serves the build over `app://`, not from a packaged build.

**For you**

- In the Publish window's changelog note, or a listing's changelog **Add Entry**, point at the date button and then click it. The calendar should appear at once, with no empty box first.
