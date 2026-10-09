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

Each line reports size, frame rate, length, bitrate and codecs. A mismatch prints `FAIL` and the command exits with code 1. To render one cut, name it: `npm run render -- TrailerWide`, or `npm run render:wide`.

Rendered videos are not tracked.

## Wide cut (Steam)

```bash
npm run render:wide
```

The wide cut plays the storyboard's 19 shots (`docs-internal/specs/trailer/storyboard.md`, §2) in 63.05 s. The command encodes it for Steam and checks the result:

| Check | Limit |
|---|---|
| Size and rate | 1920x1080, 60 fps |
| Codec | H.264 in MP4, no audio track yet |
| Bitrate | 5,000 Kbps or more (the encode targets 12 Mbps) |
| Length | Under 90 s |
| Loop | Frame 0 and frame 359 are identical, so the first 6 s loop |
| Poster | `out/TrailerWide-poster.png`, the last frame, 1920x1080 |

- 🔁 The first 6 s (shots W01 to W03) cut between shots and start and end on the same blurred library plate. Steam cuts its microtrailer from them.
- 🖼️ The poster is the last frame of the encoded video, cut out as a PNG at the video's size.
- ⏱️ The tall cut still plays the 20 s proof until ticket 06 gives it its own shot order.

Edit the shot list, copy and camera moves in `src/timeline.tsx`. The studio's **TrailerWide** composition shows the result live.

## Scene library

The studio's **Scene-library** folder lists every scene type and transition in both layouts, for example `KineticText-wide` and `KineticText-tall`. Each entry uses sample copy from the storyboard.

| Scene | File | Takes |
|---|---|---|
| Kinetic text card | `src/scenes/KineticText.tsx` | One or two lines, an optional blurred still plate |
| Frame camera | `src/scenes/FrameScene.tsx` | A shot, a camera path per layout, an optional callout region and caption, and `fromPlate` to focus in from the shot's own plate |
| Stack | `src/scenes/StackScene.tsx` | Two panes, each with a shot, a camera path and a caption. Tall stacks top and bottom; wide sits side by side |
| Typed prompt, then narration | `src/scenes/TypedNarration.tsx` | A player line (empty for none), the narration, an optional shot behind (`before`, then `after`) |
| Plate title | `src/scenes/PlateTitle.tsx` | The wordmark alone over a blurred shot; it ends on the bare plate |
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

Optional fields on a shot:

| Field | Does |
|---|---|
| `storyboard` | The storyboard capture ID (C01 to C12), for the record |
| `scene` | A game scene file other than the demo one, such as `scripts/fixtures/trailer-chat.json` |
| `setup` | Names from `scripts/captureSetups.mjs` that replace the shot's network and storage with fixed data (below) |
| `steps` | Moves after the screen is up: `editWorld`, `click`, `link`, `uncheck`, `ask`, `wait` |
| `expect` | Text that must be on screen after the steps, so a shot never saves the wrong state |
| `verify` | `false` skips the game screen's layout check for a shot that is not the demo turn |
| `deferred` | A later ticket's shot. It stays in the list and `npm run capture` skips it; `--only` runs it |

Setups keep every shot off live servers and live AI:

| Setup | Fixes |
|---|---|
| `ageGate`, `tutorialsSeen` | The age attestation and every onboarding popover |
| `communityListings` | The community catalog: the bundled worlds, no counts, from the router's own route |
| `contestListings` | The router's canned decided contest, with its three entries in the catalog |
| `defaultEndpoint` | The Demo AI preset, answering its model list |
| `helpAnswer` | The help window's reply, streamed from a fixed text |

The storyboard's three live-data shots (help answer, community grid, avatar) are fixed this way. The avatar shot unchecks **Animate character**, so it shows the model's rest pose and never a moving frame.

## How it fits together

| Part | File |
|---|---|
| Scene list and timing for each cut | `src/timeline.tsx` |
| The two compositions and the scene library folder | `src/Root.tsx` |
| Scene library entries for the studio | `src/library.tsx` |
| Title card scene, with an optional call-to-action line | `src/scenes/TitleCard.tsx` |
| Scenes: kinetic text, frame camera, stack, typed narration | `src/scenes/` |
| Shared parts: the moving camera, the copy block, the plate and the wordmark | `src/parts/` |
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
