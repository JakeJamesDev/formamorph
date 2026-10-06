# Editor-speed harness

Measures the World Editor on a large generated world under CPU throttle.

```
npm run profile:editor-speed
```

- Generates the world with `genLargeWorld.mjs` if it is missing (400 entities, 300 locations with 150 under one parent, 475 noise PNGs, ~126 MB). Run the generator yourself to change sizes: `node testing/editor-speed/genLargeWorld.mjs --entities 1000`.
- Builds an unminified production bundle into `testing/editor-speed/.build/`, serves it, and writes the world straight into the library store.
- Steps, in order: `open`, `typing`, `treeDrag`, `canvas`, `canvasDrag`, `save`, `idb`.
- Reports per step: wall time, main-thread blocks over 50 ms (from a trace), frame intervals for drags, input-to-paint latency for typing, DOM counts for the canvas, and JS heap after GC.
- Reports the Main Menu first: the number of worlds in the library and `heapMenuMb`, the JS heap after GC.
- `idb` runs outside the app, on a blank page of the same origin. It times IndexedDB on the bench world record, 3 runs each, and reports the median. This is the structured-clone floor for open and save.
  - `put` and `get`: one bare call each.
  - `getThenPut`: a get, then a put from its success handler. This is the shape of the library's `storeWorld`.
- Writes `.out/results.json`, or `.out/results-<library>.json` for the other libraries. Needs Chromium: `npm run test:e2e:install`.
- Outside the four gates.

### Main Menu heap

Compare the menu heap across library sizes:

```
EDITOR_SPEED_LIBRARY=empty EDITOR_SPEED_HEAP_SNAPSHOT=1 npm run profile:editor-speed
EDITOR_SPEED_HEAP_SNAPSHOT=1 npm run profile:editor-speed
```

- `EDITOR_SPEED_HEAP_SNAPSHOT` writes `.out/<point>-<library>-<rate>x.heapsnapshot` at three points: `menu`, after `open`, and after `save`. The files open in DevTools → Memory.
- Each snapshot also prints a summary:
  - the top retainers by retained size, with their shortest path from a GC root
  - self size by type
  - strings over 100 KB, grouped by path
- `node testing/editor-speed/heapRetainers.mjs <file>` prints the same summary for any snapshot.
- The `defaults` and `empty` libraries stop after the menu. The editor steps need the bench world.

| Variable | Default | Effect |
|---|---|---|
| `EDITOR_SPEED_THROTTLE` | `6` | CPU slowdown rates, comma-separated |
| `EDITOR_SPEED_WORLD` | `.out/large-world-400e-300l.json` | World file to load |
| `EDITOR_SPEED_ONLY` | all | Steps to run, comma-separated |
| `EDITOR_SPEED_LIBRARY` | `bench` | `bench`: default worlds plus the bench world. `defaults`: default worlds only. `empty`: no worlds |
| `EDITOR_SPEED_HEAP_SNAPSHOT` | unset | Snapshot the Main Menu heap and print its top retainers |
| `EDITOR_SPEED_DRAG_NODE` | unset | Location id the `canvasDrag` step grabs. Unset, it grabs the fourth box drawn, which depends on the view |
| `EDITOR_SPEED_PROFILE` | unset | Print the 25 functions with the most self time during the `canvasDrag` pointer moves, and each step's main-thread time by trace event |
| `EDITOR_SPEED_SKIP_BUILD` | unset | Reuse the last build |
| `EDITOR_SPEED_SHOT` | unset | Screenshot a failed step into `.out/` |
| `EDITOR_SPEED_HEADED` | unset | Show the browser |
