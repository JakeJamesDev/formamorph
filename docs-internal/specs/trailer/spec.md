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
| Q9 | The storyboard is approved (2026-10-08, ticket 03): wide cut 19 shots, tall cut 13 shots; lengths as of ticket 11: wide 68.45 s (4,107 frames), tall 51.03 s (3,062 frames); frames 0 to 359 loop on the bare blob stage (Q28). |
| Q10 | Feature cut: Morphie help, contests and 3D avatars stay in the wide cut. Memory is cut. Scene images, character cards and ST import, themes, TTS and authoring tools are not in the trailer. |
| Q11 | The end card's call-to-action line is "formamorph.ai". |
| Q12 | Gameplay shots use the Drone world on the landing page's site-game fixture. |
| Q13 | The tall cut's two gameplay shots are native 540x960 (scale 2) mobile-layout recaptures, not crops of the wide capture. |
| Q14 | The typed scene draws its own text in Design System type roles: a prompt line types in with a caret, then a narration line streams in word by word. Copy comes in as props; ticket 05 supplies it. An optional captured frame sits behind it under the frame camera. The drawn text is a stylized overlay and never imitates the real input over a PNG. Frame scenes take an optional caption through a copy block shared with kinetic text. |
| Q15 | Ticket 05 copies the whole storyboard capture table into the capture list, tall rows included, and captures the 12 wide shots. Ticket 06 captures the tall rows. Ticket 05 splits the timeline: the wide composition plays the storyboard; the tall composition keeps the 20 s proof scenes until 06 replaces them, so one command still renders both. |
| Q16 | The tall cut's length is the storyboard's (Q9), not a fixed target. Ticket 06's earlier 15 to 30 s target was a pre-storyboard estimate and is withdrawn; ticket 06 fixes its own length line. |
| Q17 | Reading bar for every line of on-screen copy: at most 12 characters per second and at least 1.5 s of hold, measured on the frames the line is fully legible (after its enter animation, before its exit and the join overlap). Basis: Netflix holds a subtitle 5/6 s to 7 s at 20 characters per second for adults; the BBC runs 160 to 180 words per minute. Trailer copy animates in and competes with the image, so the bar is about half subtitle pace. The render check enforces it. |
| Q18 | Transitions run longer: fade 0.5 s (30 frames), wipe 0.6 s (36 frames). |
| Q19 | The stats shot plays the app's real stat-bar animation, captured frame by frame from the running app as a short clip, not a still with a camera move and not a re-creation in Remotion. |
| Q20 | The avatar shot shows the idle animation frozen at a fixed time, never the rest pose. The capture keeps the animate toggle on and controls the clock. |
| Q21 | The 6 s loop (Q9) and the reading bar (Q17) both hold. Inside the loop, W02's narration line shortens to 18 characters or fewer (Q25 took the budget from 22; the line is "The AI narrates.") and the typed scene's lead-in and pause shrink, so W01 and W02 each meet the bar within 360 frames. Legible frames for streamed narration count from the last word landing. The W03 wordmark is a logo and is not measured; the title card's two lines are. |
| Q22 | Camera motion is linear. No easing on any leg. |
| Q23 | The camera zooms during a shot only where the subject is small and is the point: the stats (W06) and the Morphie answer (W13). Every other frame shot appears at a fixed zoom and drifts with one slow linear pan across the whole shot, very subtle, a few percent of the frame. The zoom never changes during those shots. Static crops: entity, profile, contest (keeps its callout), endpoint on the model field. Full frame: library, map, blueprints, community, chat, avatar, the typed backdrops, and the tall recaptures. The end card's backdrop holds a fixed scale too, with the same drift if it needs motion. |
| Q24 | The avatar shot plays a clip of the idle animation, captured frame by frame with the page clock controlled, so the avatar moves. |
| Q25 | Text enters and leaves calmly: at least 0.5 s for a line to enter and 0.5 s to leave, with a gentle curve. The render check reports each line's enter and exit seconds beside its hold and fails a line under either. Shots lengthen as needed so the 1.5 s hold (Q17) still stands. |
| Q26 | Ticket 09 details. The T06 stats pane zooms like W06. In the tall cut, "full frame" means the existing 9:16 crop window at a fixed zoom with the drift; static crops keep their crops in both cuts. Full-frame shots sit near zoom 1.05 so the drift has room; the render check measures each drift shot's screen travel and fails one under 1% or over 5% of the frame, aiming at about 3%. The end card's lines hold to the last frame, reported as such and passed. The W03 wordmark keeps its motion; Q25 covers the title card's tagline and call-to-action lines. Loop budget: W01 150, W02 150, W03 60 frames. The contest shot's static crop is zoom 1.12, so the whole podium callout stays in frame. The loop's library plate holds at W04's opening camera, so the cut at frame 360 has no jump. |
| Q27 | The motion language is prototype variant A, "Floating cards": UI shots are tilted glass cards with rounded corners and a deep shadow, entering on an overshooting spring from below and floating on a slow bob, with a second dimmed card behind for depth; slow glowing blobs in the brand palette drift behind everything; headline words rise one by one on springs with a slight tilt and a gradient accent on the last word; captions are glass pills; the wordmark rises on a spring. Springs on entrances are the motion; Q22's linear rule covers camera pans inside a shot, Q23 still holds (no zoom change except stats and Morphie), and Q17 and Q25 still bound the copy timing. Branch `prototype/trailer-motion`, commit `4d68295a`, launch entry `proto-trailer-motion` on 5262, compositions Proto-A, Proto-B, Proto-C. |
| Q28 | Ticket 10 details. Every blurred plate goes; scenes sit on the one blob stage. The loop (Q9, Q26) begins and ends on the bare blob stage: frames 0 and 359 show no card and no text, and W04's card springs in at frame 360. The blobs move on a 359-frame period for the whole cut, each on a small closed path of about 60 px, so the loop check still holds byte for byte. A card that does not zoom holds its crop still; the card's bob and exit drift carry the motion, and the camera check requires zero inner drift on those shots, replacing the 1 to 5 percent band. The end card drops the stitched backdrop: the wordmark springs in on the stage with two dimmed cards (library, game) floating behind; Q23's end-card drift sentence no longer applies. In the typed scenes the before-then-after game shot is the dimmed card behind and the prompt panel is the front glass card. The tall stacks (T06, T10, T11) have no third card: the two stacked cards are each other's depth; the depth card applies to single-card shots. |
| Q29 | Joins are plain overlaps on the shared stage: the outgoing cards and copy leave by their own exit while the incoming ones spring in. No fade or wipe presentation, because a moving edge cut through cards and words once the plates were gone. The two join lengths from Q18 stay and are renamed: `overlap` is 30 frames inside a section, `section` is 36 frames between sections. The storyboard uses those names. |
| Q30 | The loop (frames 0 to 359) is W01 "Type any action." then the wordmark. W02 is cut from the wide and tall cuts; it repeated W05. The wordmark holds about 2.5 s. Q21's short-line rule no longer applies. |
| Q31 | W05 captures the real narration reveal as a clip, like the stats clip, and plays it in the card. The typed panel sits below the card, never over it. |
| Q32 | No shot zooms. The stats and Morphie cards open already framed on their subject (the stats panel, the help answer) and hold that crop. Q23's two exceptions are retired; the camera check requires zero inner motion on every card. |
| Q33 | The map shot captures the Veilwood canvas after Auto Arrange All with the travel-rule edge labels hidden, so only boxes and arrows show. |
| Q34 | A travel shot follows the map: the in-game Change Location dialog, caption "Travel there and meet who lives there." The order is map, travel, profile, blueprints. |
| Q35 | The contest capture's mock gives each world one placement badge. |
| Q36 | The desktop shot shows the desktop's built-in engine panel with a model loaded and ready, under the caption "Play in your browser or offline on your desktop." The endpoint form is out. |
| Q37 | The end card's call to action reads as a link: "Play free at formamorph.ai" with the address in the accent color and no bullet dot. |
| Q38 | Every captured frame that carries the shot's point must show that point whole for the full hold. The render check gets a per-shot "subject region" and fails a shot whose region leaves the card's visible area at any frame. |
| Q39 | Q38's visible area is the card's crop window less anything drawn over it: a caption pill that covers the subject fails the shot too, since a covered subject was the first finding of the third review. The card's tilt is not counted. Depth cards are not checked. In W05 and T05 the panel types only the player line; the clip carries the narration, so two texts never stream at once. "The narrator continues the story." stays as a plain caption line that enters once the reveal starts. The tall cut stacks map and travel as one stack (T09). |
| Q40 | The cut opens on the Formamorph title card. "Type any action." (W01) is cut. The 6 s loop is the opening title card alone: it enters, holds and leaves inside frames 0 to 359 on the bare stage. Q30 is superseded. |
| Q41 | The narration reveal clip (Q31) is recaptured against the current app, after the user's recent reveal fixes. It must look smooth. The capture reports the per-frame pixel change of the clip and fails a frame whose change is far above the clip's median, so a jumpy step never ships. |
| Q42 | The chat shot (W08/T07) captures the Authoring Tour's world and its entity, not the Drone world, so the trailer shows more than one world. |
| Q43 | Order in the authoring section: map, "Write who lives there." (profile), then "Then travel there and meet them." (Change Location dialog), then the traits title card, then blueprints. Q34's line and order are superseded. |
| Q44 | A title card about traits sits before "Let players pick a race and a class." Copy proposed by the spec session, user may change: "Traits shape who you play." |
| Q45 | A title card about needing help sits before the Morphie shot. Copy proposed by the spec session, user may change: "Need help? Just ask." |
| Q46 | The Morphie caption is "Ask your AI guide Morphie for help at any time." |
| Q47 | The Morphie shot is a clip: she starts in her thinking animation and moves to idle as her answer streams in. Captured with the page clock controlled, like the avatar clip, with the help answer canned. |
| Q48 | The contest shot holds longer: its card is dense, so the hold is at least 5 s after the card lands, and the two caption lines keep their stagger. A dense card is one whose subject region holds more than one element the eye must find; the storyboard marks those and they get at least 5 s. |
| Q49 | The end card's wordmark enters the way the app's first-run intro does: a field of goo blobs pops in, magnetizes into place and coalesces into the letterforms through a metaball filter. The trailer ports that animation from the app's intro into a frame-driven Remotion scene, same timing and look, deterministic per frame. The wordmark's spring entrance is retired on the end card. |
| Q50 | The community mock gives each world its own author name from the repo's neutral fixture set. No two worlds share an author, and none is "Formamorph". |
| Q51 | Ticket 12 details. The opening card is the wordmark alone, stretched to the 360-frame loop, no tagline. Tall cut order: T09 map alone, T10 profile and travel stacked, the traits card, blueprints alone. The tall cut drops the help card along with Morphie; the traits card stays in both cuts. |
| Q52 | The reveal clip ships as the app behaves: the narration card opens a full line in one frame and the words fade in over it. The user chose not to change the app for the trailer. Q41's smoothness check exempts frames where the change is the card's bottom edge growing (one line or a paragraph gap plus a line) and still fails any other spike. The one other exemption is frame 1 of a reveal clip, the app's own submit (input clears, the action line appears). The edge bands accept one line or a gap plus a line only; two lines in one frame fails. The rule fails reveal clips; the Morphie clip prints its series without failing, since her change is real motion. |

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
| 08 | Review fixes | 07 | The first review: reading bar and transition lengths (Q17, Q18), the real stat animation as a clip (Q19), the avatar in its idle pose (Q20). |
| 09 | Camera and motion pass | 08 | The second review: linear camera (Q22), zoom only on stats and Morphie with subtle drift elsewhere (Q23), avatar in motion (Q24), calm text enter and exit with a measured check (Q25). |
| 10 | Apply the motion language | 09 | Every shot in both cuts rebuilt in the Floating cards language (Q27), iterated by eye against contact sheets. |
| 11 | Third review fixes | 10 | Loop and wordmark (Q30), narration reveal clip (Q31), no zooms and a subject-region check (Q32, Q38), map, travel, contest, desktop and end-card shots (Q33 to Q37). |
| 12 | Fourth review fixes | 11 | Title card opening and loop (Q40), smooth reveal recapture (Q41), chat shot world (Q42), authoring order with two title cards (Q43 to Q45), Morphie caption and animated clip (Q46, Q47). |
| 13 | Fifth review fixes | 12 | Contest hold and dense-card rule (Q48), goo wordmark on the end card (Q49), varied community authors (Q50). |
