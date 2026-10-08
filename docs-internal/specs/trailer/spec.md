# Trailer

Status: ready-for-agent
Spec session: trailer — spec

## Problem Statement

Formamorph's store presence is stills only. The landing page, itch and the planned Steam page all show screenshots. A video sells a feature set better than a grid of images, and Steam puts the trailer first on the page.

Gameplay is text. Watching someone read is not a trailer. The video is a showcase: on-screen copy, moving graphics, and real UI frames with pans, zooms and transitions. No gameplay capture carries it.

## Solution

- **Build the trailer as code with Remotion.** Every scene is a React component. Animations are code. Renders go through headless Chromium to MP4. It is React and TypeScript like the app, so we author in the Design System's tokens and re-render on every edit. The package runs its own React version (Q7). No video editor.
- **Own package, outside the app.** The trailer lives in `marketing/trailer/` with its own `package.json`, `tsconfig` and Remotion dependencies. Nothing enters the game bundle or the root dependencies.
- **Real UI frames come from Playwright.** A capture script poses screens through the dev-router on a fixed demo world and writes PNGs the scenes import. Same approach as the existing title-card capture.
- **One scene set, two cuts.** Each scene takes a layout for 16:9 and 9:16. Two compositions render from one scene list.
- **Text only.** On-screen copy carries the message. It follows the app's copy rules.
- **Silent until music is settled.** The proof and the first cuts render without audio. Music is its own decision.

## User Stories

1. As a visitor to the Steam page, I want a trailer that shows what the app does in under 90 seconds, so that I decide to wishlist.
2. As a visitor on a muted autoplay, I want the on-screen copy to carry the message, so that I get it without sound.
3. As a visitor on socials, I want a vertical cut, so that it fills my screen.
4. As the owner, I want to change one line of copy and re-render, so that the trailer stays current with each release.
5. As the owner, I want the UI frames captured from the real app, so that the trailer never shows a mockup that drifts from the product.
6. As the owner, I want the first 6 seconds to work as a silent loop, so that Steam's auto-generated microtrailer looks intentional.

## Implementation Decisions

### Rulings

| # | Ruling |
|---|---|
| Q1 | Remotion is the build tool. Verified 2026-10-08: latest `4.0.534`, peer React ≥16.8, free license for individuals and companies up to 3 employees, commercial use allowed. |
| Q2 | Two outputs: Steam 16:9 at 1920x1080, and a 9:16 social cut at 1080x1920. |
| Q3 | Text only. No voiceover. |
| Q4 | The proof renders silent. Music is decided later and gets its own ticket. |
| Q5 | The trailer lives in `marketing/trailer/` as its own package. It is excluded from the root typecheck, lint and test gates and has its own scripts. |
| Q6 | The proof is 20 seconds: one title card, two UI frames with motion, one transition, rendered at both sizes. The pipeline is proven before the storyboard is written. |
| Q7 | The trailer package uses React 19. `@remotion/transitions` 4.0.534 bundles a React DOM 19 copy and reads React 19 internals, so it fails to bundle against React 18 despite its declared peer range. The package is standalone (Q5), so the app stays on React 18. Ruled 2026-10-08 on ticket 01's evidence. |
| Q8 | The storyboard lives at `docs-internal/specs/trailer/storyboard.md` and lands in ticket 03's commit. It holds its own capture table in the spec's field list (view, modal or tab, viewport, theme, scale, world, seed). Ticket 05 copies that table into ticket 02's capture list, so 02 and 03 never race on one file. The user approves the storyboard in the 03 session; its rulings come here as numbered Q-lines and fold into this spec. |
| Q9 | The storyboard is approved (2026-10-08, ticket 03): wide cut 19 shots, 63.05 s (3,783 frames); tall cut 14 shots, 47.80 s (2,868 frames); frames 0 to 359 loop on a shared blurred library plate. |
| Q10 | Feature cut: Morphie help, contests and 3D avatars stay in the wide cut. Memory is cut. Scene images, character cards and ST import, themes, TTS and authoring tools are not in the trailer. |
| Q11 | The end card's call-to-action line is "formamorph.ai". |
| Q12 | Gameplay shots use the Drone world on the landing page's site-game fixture. |
| Q13 | The tall cut's two gameplay shots are native 540x960 (scale 2) mobile-layout recaptures, not crops of the wide capture. |

### Facts the design rests on

- Steam store trailer spec (partner docs, read 2026-10-08): up to 1920x1080, 30/29.97 or 60/59.94 fps, 5,000+ Kbps, `.mp4` with H.264 video and AAC audio preferred, 16:9 preferred. No duration or file-size limit is stated. Steam auto-generates a 6-second looping microtrailer from the start of the first trailer. A custom poster must be a 1920x1080 frame from the video.
- A title card already exists: [build-assets/title-card/index.html](../../../build-assets/title-card/index.html), a fixed 1920x1080 stage with the wordmark, the VRM avatar and two app shots. Fonts are Lexend and Baloo 2. [captureTitleCard.mjs](../../../scripts/captureTitleCard.mjs) captures it with Playwright. The trailer's opening scene starts from this look.
- Store screenshots live in [hosting/site/shots/](../../../hosting/site/shots/) per theme and mode. The proof can use these. The full build captures fresh frames.
- The e2e runner starts a dev server on 5183 and navigates with `window.__fmDev.goto`. The capture script reuses that path, with `BASELINE_NO_WATCH` so a peer's edit never reloads a capture mid-run.
- Remotion downloads its own Chrome Headless Shell on first render. It can also take a browser executable, so Playwright's Chromium is an option if the download is a problem.
- Default worlds in [src/defaultworlds/](../../../src/defaultworlds/) are the capture candidates. Which world poses which screen is a storyboard decision.

### The scene model

- A scene is a component that takes `layout: 'wide' | 'tall'` and a duration in frames. It positions its own content for each layout.
- Kinetic text follows the Design System's type roles and colors, rendered with Lexend. Copy is STE and passes the copy sweep.
- A UI frame scene takes a captured PNG and a camera path (pan, zoom) in frames. Captured frames are committed as source assets, not generated at render time.
- Transitions are shared components. The proof ships one.
- Timing is in frames at 60 fps. Both compositions render from one scene set. The tall cut has its own shot order, derived from the wide one (storyboard §4).

### Points to check during build

- Capture at device scale 2 for crisp zooms. Check file size before committing.
- Fonts load through Remotion's font loader, not a `<link>`, so renders never race the network.
- The first 6 seconds must read as a loop on their own (microtrailer).
- Both cuts render from one command. Rendered MP4s are gitignored; only source and captures are tracked.
- Three shots need canned or frozen inputs to capture deterministically (storyboard §5): the help answer (live endpoint), the community world grid (live server data; contest listings are already canned through the dev-router), and the avatar's WebGL frame. Tickets 02 and 05 own this.

## Testing Decisions

- The render is the test. A ticket is done when both MP4s render from one command and a frame check matches the expected resolution and duration.
- Captures are deterministic: same world, same seed, same viewport. A capture diff against the committed PNG is the guard against UI drift.
- Copy goes through the copy sweep before the final render.
- No Vitest coverage. The package is outside the gates.

## Out of Scope

- Voiceover, including Kokoro TTS.
- Music selection and licensing. A later ticket.
- Embedding the video on the landing page or itch. A later effort.
- Gameplay recordings. Short motion clips (streaming narration, stat bars) may come later as their own scene type.
- Localized cuts.

## Further Notes

- Nothing here changes the app, world or save shape.
- Remotion's license tier depends on company size. Re-check it if the company grows past 3 employees before the Steam release.

## Proposed tickets

| # | Title | Blocked by | Delivers |
|---|---|---|---|
| 01 | Trailer workspace and proof render | None | `marketing/trailer/` package, wide and tall compositions, title card scene, two frame scenes from existing shots, one transition. One command renders both 20 s MP4s. |
| 02 | Frame capture pipeline | 01 | Playwright script poses screens via the dev-router on a fixed world and writes PNGs into the package. Deterministic and diffable. |
| 03 | Storyboard | 01 | Feature list, shot order, copy, timing for both cuts. Human ruling; the user cuts it down. |
| 04 | Scene library | 01, 03 | Kinetic text card, frame camera, typed-prompt-then-narration, shared transitions, each with wide and tall layouts. |
| 05 | Full 16:9 cut | 02, 04 | The Steam trailer at 1920x1080, 60 fps, Steam encode settings. First 6 s works as a loop. |
| 06 | 9:16 cut | 05 | The social cut at 1080x1920 from the same scene set, on its own shot order. |
| 07 | Copy sweep and final renders | 05, 06 | Copy pass, final encodes, poster frame, check against the Steam spec. |
