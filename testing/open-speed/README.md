# Open-speed harness

Measures how fast Community Creations opens: cold, warm 1 and warm 2 (page reloads), and reopen (close, then open again in the same page), at 1× and 4× CPU throttle.

```
npm run profile:open-speed
```

- Builds an unminified production bundle into `testing/open-speed/.build/` (not `dist/`), then serves it.
- Stubs the catalog with 700 rows (`OPEN_SPEED_ROWS`). `OPEN_SPEED_THROTTLE=1,4` picks the rates.
- Reports per open: time until the window is painted (`visibleMs`), main-thread blocks over 50 ms (from a trace), and the share of main-thread script time inside tooltip frames (`tooltipPct`, from a CPU profile in the same trace; React's scheduler frames are minified, so script time stands in for render time).
- Writes `results.json` beside the script. Needs Chromium: `npm run test:e2e:install`.
- Outside the four gates.
