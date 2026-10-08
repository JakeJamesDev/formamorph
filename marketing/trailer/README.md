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

## How it fits together

| Part | File |
|---|---|
| Scene list and timing, shared by both cuts | `src/timeline.tsx` |
| The two compositions | `src/Root.tsx` |
| Title card scene | `src/scenes/TitleCard.tsx` |
| UI frame scene: a captured shot under a moving camera | `src/scenes/FrameScene.tsx` |
| The scene transition | `src/transitions.ts` |
| Fonts and colors | `src/theme.ts` |
| Captured UI shots | `public/shots/` |

- 📐 A scene gets a `layout` (`wide` or `tall`) and its length in frames. It places its own content for each layout.
- ⏱️ Timing is in frames at 60 fps. A transition overlaps the two scenes it joins.
- 🔤 Fonts load through Remotion's Google Fonts loader, which holds each frame until the fonts are ready.
- 🔇 The trailer is silent for now.
