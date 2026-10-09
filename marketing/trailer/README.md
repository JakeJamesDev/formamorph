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

The wide cut also writes its poster frame, `out/TrailerWide-poster.png`.

Each line reports size, frame rate, length, bitrate and codecs. A mismatch prints `FAIL` and the command exits with code 1. To render one cut, name it: `npm run render -- TrailerWide`, or `npm run render:wide`.

The command also checks every line of copy against the reading bar. Each line reports its shot, the seconds it takes to enter, the seconds it is fully legible, the seconds it takes to leave, and its characters per second. It prints `FAIL` for a line that:

- holds under 1.5 s or reads over 12 characters per second
- enters or leaves in under 0.5 s

Notes:

- 📏 A line is legible from the frame its enter animation ends until its exit starts or a join begins to cover it. Typed and streamed text counts from its last character.
- 🔚 The end card's lines stay to the last frame. Their exit prints `holds to end`.
- ✏️ A longer line needs a longer shot. Raise the shot's frames in `src/timeline.tsx` until its line prints `OK`. The wordmark is a logo and is not measured.

The command also checks the camera inside every card. Each camera reports its zoom, or `holds` when its crop stays still. It prints `FAIL` when:

- the move is not linear, because the shot's edge stops the camera partway
- a shot other than W06, W13 or the T06 stats pane changes zoom
- a card that does not zoom pans at all; the card's own float is the motion

The render leaves its files in `out/`:

- 📁 `out/` is not tracked. Upload the two MP4s and the poster from there.
- 🧪 `out/*-loop-first.png` and `out/*-loop-last.png` are the frames the loop check compares. You can delete them.

## Contact sheets

```bash
npm run sheet
```

This writes each cut's contact sheet to `out/sheets/`, for example `wide-1.png`. Each shot is a row of five frames: entering, settled, mid-hold, late, and leaving into the join. A page holds four wide shots or two tall ones. To render one cut, name it: `npm run sheet -- tall`.

- 👀 Look at every cell before you call a shot done. A sheet takes about 40 s, much less than a render.
- 🎬 The studio's **Sheets** folder shows the same pages live; set `page` in the props.

## Re-render after a release

Run these steps from `marketing/trailer` after each release, before you upload a new cut.

1. **Check the frames.** Run `npm run capture:diff`. A `CHANGED` line means the app's UI moved since the last capture.
2. **Update the frames.** For each changed shot, run `npm run capture -- --only <id>`. Open the new PNG in `public/shots/` and check it. Commit the PNGs you keep.
3. **Check the copy.** Edit lines in `src/timeline.tsx`. Keep them short, active and in the app's terms (see [Copy](#copy)).
4. **Check the claims.** The "hundreds of worlds" line must stay true. Run `curl "https://api.formamorph.ai/api/worlds?page=1&limit=1"` and read `total`.
5. **Render.** Run `npm run render`. Every line must print `OK`.
6. **Check the cut.** Open `out/TrailerWide.mp4` and scrub it. The Steam checks in [Wide cut (Steam)](#wide-cut-steam) pass in the render output.

## Copy

All on-screen copy is in `src/timeline.tsx`, plus the end card's tagline in `src/scenes/TitleCard.tsx`. The app's `npm run copy:sweep` does not read it, so check it by hand against the Writing Guide.

- ✍️ Short active sentences, common words, no metaphor, American English.
- 🔤 The product is an "AI text RPG" and the player "types" an action. Use those words everywhere.
- 🚫 Never "character" (write "anyone" or "who"), never "phone" (write "mobile"), never "picture" (write "image").
- 🎯 Each line says what you can do. No line names a rival or a missing feature.

## Wide cut (Steam)

```bash
npm run render:wide
```

The wide cut plays the storyboard's 19 shots (`docs-internal/specs/trailer/storyboard.md`, §2) in 64.45 s. The command encodes it for Steam and checks the result:

| Check | Limit |
|---|---|
| Size and rate | 1920x1080, 60 fps |
| Codec | H.264 in MP4, no audio track yet |
| Bitrate | 5,000 Kbps or more (the encode targets 12 Mbps) |
| Length | Under 90 s |
| Loop | Frame 0 and frame 359 are identical, so the first 6 s loop |
| Poster | `out/TrailerWide-poster.png`, the last frame, 1920x1080 |

- 🔁 The first 6 s (shots W01 to W03) cut between shots and start and end on the bare stage. Steam cuts its microtrailer from them. The stage's blobs repeat every 359 frames (`STAGE_PERIOD` in `src/parts/Stage.tsx`), so frame 359 matches frame 0, and W04's card springs in over the same stage.
- 🖼️ The poster is the last frame of the encoded video, cut out as a PNG at the video's size.

Edit the shot list, copy and camera moves in `src/timeline.tsx`. The studio's **TrailerWide** composition shows the result live.

## Tall cut (social)

```bash
npm run render:tall
```

The tall cut plays the storyboard's 14 shots (§4) in 50.20 s at 1080x1920, 60 fps. It comes from the same scene list as the wide cut and has its own shot order. `npm run render` renders both.

| Treatment | Shots | How |
|---|---|---|
| Relayout | T01, T03, T08, T12, T14 | The scene places its own content for `tall` |
| Crop | T04, T07, T09, T13 | The card fills the width and shows a 3:4 window of the wide capture. Each scene has one camera path per layout |
| Stack | T06, T10, T11 | Two wide captures on two cards, one above the other, each with its own caption pill |
| Recapture | T02, T05 | The native 540x960 mobile-layout shots `turn-before-tall` and `game-tall` |

- ✂️ The tall cut drops W13 (Morphie) and W18 (avatar).
- 🔁 T01 to T03 match W01 to W03, so the tall cut loops for its first 6 s too.
- 📱 `npm run capture -- --only game-tall` and `--only turn-before-tall` rewrite the two recaptures.
- 🎯 The tall cut has no Steam checks. The render command checks its size, rate, length, codecs and the 6 s loop.

## Scene library

The studio's **Scene-library** folder lists every scene type and transition in both layouts, for example `KineticText-wide` and `KineticText-tall`. Each entry uses sample copy from the storyboard.

| Scene | File | Takes |
|---|---|---|
| Kinetic text card | `src/scenes/KineticText.tsx` | One or two lines that rise word by word |
| Frame card | `src/scenes/FrameScene.tsx` | A shot, a camera path per layout, a depth shot for the card behind, an optional callout region, caption and dot color, and optional card placement |
| Stack | `src/scenes/StackScene.tsx` | Two cards, each with a shot, a camera path, a caption and a dot color. Tall stacks top and bottom; wide sits side by side |
| Typed prompt, then narration | `src/scenes/TypedNarration.tsx` | A player line (empty for none), the narration, an optional shot on the card behind (`before`, then `after`) |
| Wordmark title | `src/scenes/WordmarkTitle.tsx` | The wordmark alone on the stage; it ends on the bare stage |
| Cut, overlap, section | `src/transitions.tsx` | `TransitionName`; a cut has no overlap, an overlap joins 30 frames inside a section, a section join 36 |

The look is the Floating cards language:

- 🌌 One stage sits under the whole cut: slow glowing blobs in the brand palette (`src/parts/Stage.tsx`). Scenes are transparent, so a join never cuts the stage.
- 🃏 Each shot is a tilted glass card (`src/parts/GlassCard.tsx`). It rises on an overshooting spring, floats on a slow bob, and fades as it drifts away. A dimmed card behind it shows the next or a related shot; a stack's two cards are each other's depth. Card placement per layout is in `src/poses.ts`.
- 🔤 Headlines rise word by word, the last word in the wordmark gradient. Captions are glass pills with a colored dot (`src/parts/CopyBlock.tsx`). Copy uses the app's text size roles (`typeRoles` in `src/theme.ts`) scaled to the canvas, in Lexend.
- 🔗 A join is a plain overlap: the outgoing scene leaves by its own exit while the next one springs in.
- 🎥 A camera path runs `from` to `to` at a constant rate. In `src/timeline.tsx`, `zoom` changes the zoom (W06, W13 and the T06 stats pane only), and `hold` keeps one crop for the whole shot.
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

A shot's `kind` is `page` (navigate and wait for `ready`), `game` (load the demo scene into the game view first) or `clip` (film a live turn, below). Add a shot by adding an entry to `captures.json` and a line in `src/shots.ts`.

Optional fields on a shot:

| Field | Does |
|---|---|
| `storyboard` | The storyboard capture ID (C01 to C12), for the record |
| `scene` | A game scene file other than the demo one, such as `scripts/fixtures/trailer-chat.json` |
| `setup` | Names from `scripts/captureSetups.mjs` that replace the shot's network and storage with fixed data (below) |
| `steps` | Moves after the screen is up: `editWorld`, `click`, `link`, `ask`, `wait` |
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

The storyboard's three live-data shots (help answer, community grid, avatar) are fixed this way. The avatar shot keeps **Animate character** on and sets `model` (below), so it films the idle animation on a controlled clock.

### Frozen time and clips

Two kinds of shot control the page clock, so a moving screen comes out the same on every run.

| Field | Does |
|---|---|
| `model` | Films the avatar's idle animation. `model.from` is the second of the animation the clip starts at, and `frames` is the clip's length at 60 fps. |
| `kind: "clip"` | Films one live turn instead of a still. `turn.stats` is the stat reply, and `frames` is the clip's length at 60 fps. |

A model clip holds the model files, pauses the page clock, lets the models load, then runs the clock to `model.from`. It then takes over the page's animation frames: for each film frame it moves the clock one frame (16 or 17 ms, so the frames stay on the 60 fps grid), draws once, and takes a screenshot. The avatar clip is about 0.8 MB.

A clip loads the demo scene before its turn, submits the action, and answers every AI call from fixed text. Once the narration settles, it pauses the page clock and lets the stat reply through. It then pauses every animation that starts, seeks each one frame at a time and takes a screenshot per frame. The frames encode to `public/shots/<id>.mp4`, about 1 MB, with a bit-exact encode.

- 🎞️ The stats shot (W06, and the top pane of T06) plays `stats-clip.mp4`. It holds the first frame, plays the clip from frame 60 of the scene, then holds the last frame.
- 🧍 The avatar shot (W18) plays `avatar-clip.mp4` from its first frame. The clip has as many frames as the shot, so the avatar moves to the end. Lengthen both together.
- 🔁 A second run gives the same frames and the same file, so `npm run capture:diff` prints `same`. The frames stay in `.capture-clip/` to compare two runs.
- 🧩 The script runs Vite with `scripts/captureVite.config.mjs`. It adds the real path of the repo's `node_modules` to the files Vite serves, so the stat code's QuickJS runtime also loads in a worktree.

## How it fits together

| Part | File |
|---|---|
| Scene list and timing for each cut | `src/timeline.tsx` |
| The two compositions, the scene library and the sheets | `src/Root.tsx` |
| Scene library entries for the studio | `src/library.tsx` |
| Contact sheet composition and script | `src/sheet.tsx`, `scripts/sheet.mjs` |
| End card scene, with an optional call-to-action pill | `src/scenes/TitleCard.tsx` |
| Scenes: kinetic text, frame card, stack, typed narration, wordmark title | `src/scenes/` |
| Shared parts: the stage, the glass card, the camera inside it, the headline and pills, and the wordmark | `src/parts/` |
| Where each card sits per layout | `src/poses.ts` |
| Enter and exit timing, and the springs | `src/motion.ts` |
| The reading bar and each line's reading time | `src/reading.ts` |
| Transitions | `src/transitions.tsx` |
| Fonts, type roles and colors | `src/theme.ts` |
| Capture list and the demo world, scene and seed | `captures.json` |
| Capture and diff script | `scripts/capture.mjs` |
| Captured UI shots | `public/shots/` |

- 📐 A scene gets a `layout` (`wide` or `tall`) and its length in frames. It places its own content for each layout.
- ⏱️ Timing is in frames at 60 fps. A join overlaps the two scenes it connects.
- 🔤 Fonts load through Remotion's Google Fonts loader, which holds each frame until the fonts are ready.
- 🔇 The trailer is silent for now.
