# Editor-speed harness

Measures the World Editor on a large generated world under CPU throttle.

```
npm run profile:editor-speed
```

- Generates the world with `genLargeWorld.mjs` if it is missing (400 entities, 300 locations with 150 under one parent, 475 noise PNGs, ~126 MB). Run the generator yourself to change sizes: `node testing/editor-speed/genLargeWorld.mjs --entities 1000`.
- Builds an unminified production bundle into `testing/editor-speed/.build/`, serves it, and writes the world straight into the library store.
- Steps, in order: `open`, `typing`, `treeDrag`, `canvas`, `canvasDrag`, `save`, `picker`, `import`, `idb`.
- `import` returns to the Main Menu, picks the bench world file in the world import input, and keeps the images as they are. It reports the time to the image prompt and to the world's details dialog.
- Reports per step: wall time, main-thread blocks over 50 ms (from a trace), frame intervals for drags, input-to-paint latency for typing, DOM counts for the canvas, and JS heap after GC.
- `typing` and `save` also report `heapStartMb` (after GC) and `heapPeakMb`, sampled every 50 ms without GC, so garbage the step allocates shows.
- `picker` opens the first location's Presence tab (adding a Connection when it has none), types 26 keys into a Travel Hint, then opens Connect To. It reports input latency, `openMs` for the picker, and `options` for the items listed. Run it after `open`: `EDITOR_SPEED_ONLY=open,picker`.
- Reports the Main Menu first: the number of worlds in the library and `heapMenuMb`, the JS heap after GC.
- `idb` runs outside the app, on a blank page of the same origin. It times IndexedDB on the bench world record, 3 runs each, and reports the median. This is the structured-clone floor for open and save.
  - `put` and `get`: one bare call each.
  - `getThenPut`: a get, then a put from its success handler. This is the shape of the library's `storeWorld`.
- Writes `.out/results.json`, or `.out/results-<library>.json` for the other libraries. Needs Chromium: `npm run test:e2e:install`.
- Outside the four gates.

### Pins

`node testing/editor-speed/genLargeWorld.mjs --pins 1` writes `.out/large-world-400e-300l-pins.json`: the same world plus 1,151 pins. "Mood" is pinned 551 times (every trait, half the locations, every stat band, 60 placeholders' values). "Pin Heavy Trait", "The Hub" and the "Pin Heavy" value each pin 200 placeholders. The other worlds are unchanged.

```
EDITOR_SPEED_WORLD=testing/editor-speed/.out/large-world-400e-300l-pins.json EDITOR_SPEED_ONLY=open,pinSourceTrait,pinSourceLocation,pinTarget npm run profile:editor-speed
```

- `pinTarget` opens "Mood" on the Placeholders tab and types into its Name. When typing times out, the step keeps the open's numbers and reports `typeError`.
- Each pin step reports `openMaxBlockMs`, the longest main-thread block while the record opens.
- `pinSourceTrait` and `pinSourceLocation` open the source, time its Pins tab, count pin rows, then type into Name.
- The pin steps exist only when the world file name contains `-pins`. `EDITOR_SPEED_PROFILE=1` prints a CPU profile of each open.

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
| `EDITOR_SPEED_PROFILE` | unset | CPU-profile `open`, `typing` and the `canvasDrag` pointer moves: print the functions with the most self and total time, and write `.out/<step>.cpuprofile`. Also prints what `EDITOR_SPEED_TASKS` prints. `alloc` samples allocations instead. Starting the profiler adds a long task of its own, so read block times from a run without it |
| `EDITOR_SPEED_TASKS` | unset | Print each step's main-thread time by trace event, and the events inside its three longest tasks |
| `EDITOR_SPEED_SKIP_BUILD` | unset | Reuse the last build |
| `EDITOR_SPEED_SHOT` | unset | Screenshot a failed step into `.out/` |
| `EDITOR_SPEED_HEADED` | unset | Show the browser |
