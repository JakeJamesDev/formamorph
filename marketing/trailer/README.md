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

## Scene library

The studio's **Scene-library** folder lists every scene type and transition in both layouts, for example `KineticText-wide` and `KineticText-tall`. Each entry uses sample copy from the storyboard.

| Scene | File | Takes |
|---|---|---|
| Kinetic text card | `src/scenes/KineticText.tsx` | One or two lines, an optional blurred still plate |
| Frame camera | `src/scenes/FrameScene.tsx` | A shot, a camera path per layout, an optional callout region and caption |
| Stack | `src/scenes/StackScene.tsx` | Two panes, each with a shot, a camera path and a caption. Tall stacks top and bottom; wide sits side by side |
| Typed prompt, then narration | `src/scenes/TypedNarration.tsx` | A player line, the narration, an optional shot behind (`before`, then `after`) |
| Cut, fade, wipe | `src/transitions.tsx` | `TransitionName`; a cut has no overlap, a fade overlaps 15 frames, a wipe 18 |

- 🔤 Copy uses the app's text size roles (`typeRoles` in `src/theme.ts`) scaled to the canvas, in Lexend.
- 🎥 A camera path runs `from` to `to`. Add `via` stops for a move in stages, such as a push to the input and then to the narration.
- 🖼️ Any shot prop takes one shot, or `{ wide, tall }` when the tall cut uses its own recapture (`LayoutShot` in `src/shots.ts`).
- ✍️ The typed scene is a stylized overlay, never a copy of the real input. It throws if the copy does not fit the scene's frames.
- 🧩 Add a scene by adding an entry to `ENTRIES` in `src/library.tsx`.

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
| The two compositions and the scene library folder | `src/Root.tsx` |
| Scene library entries for the studio | `src/library.tsx` |
| Title card scene | `src/scenes/TitleCard.tsx` |
| Scenes: kinetic text, frame camera, stack, typed narration | `src/scenes/` |
| Shared parts: the moving camera and the copy block | `src/parts/` |
| Enter and exit timing | `src/motion.ts` |
| Transitions | `src/transitions.tsx` |
| Fonts, type roles and colors | `src/theme.ts` |
| Capture list and the demo world, scene and seed | `captures.json` |
| Capture and diff script | `scripts/capture.mjs` |
| Captured UI shots | `public/shots/` |

- 📐 A scene gets a `layout` (`wide` or `tall`) and its length in frames. It places its own content for each layout.
- ⏱️ Timing is in frames at 60 fps. A transition overlaps the two scenes it joins.
- 🔤 Fonts load through Remotion's Google Fonts loader, which holds each frame until the fonts are ready.
- 🔇 The trailer is silent for now.
