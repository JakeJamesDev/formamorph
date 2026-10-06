# Editor-speed harness

Measures the World Editor on a large generated world under CPU throttle.

```
npm run profile:editor-speed
```

- Generates the world with `genLargeWorld.mjs` if it is missing (400 entities, 300 locations with 150 under one parent, 475 noise PNGs, ~126 MB). Run the generator yourself to change sizes: `node testing/editor-speed/genLargeWorld.mjs --entities 1000`.
- Builds an unminified production bundle into `testing/editor-speed/.build/`, serves it, and writes the world straight into the library store.
- Steps, in order: `open`, `typing`, `treeDrag`, `canvas`, `canvasDrag`, `save`.
- Reports per step: wall time, main-thread blocks over 50 ms (from a trace), frame intervals for drags, input-to-paint latency for typing, DOM counts for the canvas, and JS heap after GC.
- Writes `.out/results.json`. Needs Chromium: `npm run test:e2e:install`.
- Outside the four gates.

| Variable | Default | Effect |
|---|---|---|
| `EDITOR_SPEED_THROTTLE` | `6` | CPU slowdown rates, comma-separated |
| `EDITOR_SPEED_WORLD` | `.out/large-world-400e-300l.json` | World file to load |
| `EDITOR_SPEED_ONLY` | all | Steps to run, comma-separated |
| `EDITOR_SPEED_SKIP_BUILD` | unset | Reuse the last build |
| `EDITOR_SPEED_SHOT` | unset | Screenshot a failed step into `.out/` |
| `EDITOR_SPEED_HEADED` | unset | Show the browser |
