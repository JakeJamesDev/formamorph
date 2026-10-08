# 🎬 Formamorph Trailer

The store trailer, built as code with [Remotion](https://www.remotion.dev/). Every scene is a React component. Renders go through headless Chrome to MP4.

This is its own package. It has its own dependencies and scripts, and the app's typecheck, lint, test and build skip it.

## Install

```bash
cd marketing/trailer
npm install
```

The first render downloads Remotion's own headless Chrome.

## Preview

```bash
npm run studio
```

The studio opens in the browser. Pick **TrailerWide** or **TrailerTall** and scrub the timeline. Edits reload live.

## Render

```bash
npm run render
```

This renders both cuts to `out/` and checks each file:

| Composition | File | Size | Rate |
|---|---|---|---|
| TrailerWide | `out/TrailerWide.mp4` | 1920x1080 | 60 fps |
| TrailerTall | `out/TrailerTall.mp4` | 1080x1920 | 60 fps |

Each line reports size, frame rate, length and codecs. A mismatch prints `FAIL` and the command exits with code 1. To render one cut, name it: `npm run render -- TrailerWide`.

Rendered videos are not tracked.

## Capture UI frames

```bash
npm run capture
```

This sets up each shot in `captures.json` through the app's dev-router and writes `public/shots/<id>.png`. The scenes import these files. Run it again and the files come out identical.

| Command | What it does |
|---|---|
| `npm run capture` | Writes every shot into `public/shots/` |
| `npm run capture -- --only game` | Writes the named shots only |
| `npm run capture:diff` | Captures into `.capture-diff/` and compares each shot with the committed PNG |

- 🔎 A diff run prints `same`, `CHANGED` (with the pixel count), `NEW` or `FAILED` per shot, and a failed shot never stops the rest. It exits with code 1 when any shot changed or failed. Run it before a render to catch UI changes.
- 🖥️ The script starts its own Vite server from the repo root on port 5188 and stops it at the end. Use `--port` or `CAPTURE_PORT` for another port. It stops if the port is busy, so it never captures from your own dev server.
- 🔒 File watching is off, so a peer's edit never reloads a capture.
- 🎲 `demo` in `captures.json` fixes the world, the game scene, the random seed and the clock. Each shot sets its view, viewport, theme, palette and device scale (2).
- 📦 Shots are committed as source assets, about 2.5 MB each. Check the size of a new shot before you commit it.
- 🧩 The script needs the repo root's `node_modules` (Playwright and Vite) and its Chromium (`npm run test:e2e:install` at the root).

A shot's `kind` is `page` (navigate and wait for `ready`) or `game` (load the demo scene into the game view first). Add a shot by adding an entry to `captures.json` and a line in `src/shots.ts`.

## How it fits together

| Part | File |
|---|---|
| Scene list and timing, shared by both cuts | `src/timeline.tsx` |
| The two compositions | `src/Root.tsx` |
| Title card scene | `src/scenes/TitleCard.tsx` |
| UI frame scene: a captured shot under a moving camera | `src/scenes/FrameScene.tsx` |
| The scene transition | `src/transitions.ts` |
| Fonts and colors | `src/theme.ts` |
| Capture list and the demo world, scene and seed | `captures.json` |
| Capture and diff script | `scripts/capture.mjs` |
| Captured UI shots | `public/shots/` |

- 📐 A scene gets a `layout` (`wide` or `tall`) and its length in frames. It places its own content for each layout.
- ⏱️ Timing is in frames at 60 fps. A transition overlaps the two scenes it joins.
- 🔤 Fonts load through Remotion's Google Fonts loader, which holds each frame until the fonts are ready.
- 🔇 The trailer is silent for now.
