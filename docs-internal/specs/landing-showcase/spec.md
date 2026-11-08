# Spec: Landing Showcase

Status: ready-for-agent
Spec session: landing-showcase — spec

The formamorph.ai home page shows the game working, with a live turn, a scrolling feature tour and an inventory focus, under a purple gradient accent and the title-card wordmark.

## Problem Statement

The home page sells the game with one gallery: five screenshots under a drag divider that compares light and dark themes, with the color palettes fading in a slideshow. A visitor learns that the app has themes. They do not see the thing that makes Formamorph worth playing: a turn, where they act, the narrator answers, stats move and an item lands in their bag. Inventory is new and well liked, and the page never shows it.

The brand also does not match. The site uses a green accent and a plain system-font title. The title card, the store art and the intro use a violet-to-rose gradient and a rounded "goo" wordmark with "morph" in color. A visitor who arrives from a store page or a trailer lands on a site that looks like a different product.

## Solution

The home page opens on the wordmark exactly as the title card draws it: "Forma" plain, "morph" in the gradient, each letter heavier than the last. The Play button and other accents use the same gradient. Light or dark comes from the visitor's own theme setting, so the light/dark comparison is gone.

Under the call to action, a real game screen plays a turn. The action types itself in. The narration fades in word by word, the way the app's default reveal does. The suggested actions appear in their rows. Two stats change with the app's green and red change bands and their `+` / `−` readouts. Then the side panel switches to Inventory, and a new item appears with a highlight ring. The turn holds, then plays again.

Below that, a feature tour scrolls past one pinned screenshot that changes with each step: Play, Inventory, Library, Create, Your setup, Avatars. Each screenshot has hotspots that explain one part of the screen. On the steps that have all five color themes, the next theme sweeps across the screenshot every few seconds, and the visitor can drag the wipe or pick a theme from a row of swatches. Three cards close the page: browser, desktop and Android.

The prototype is `.scratch/landing-v2/` (untracked), served by the `scratch-landing-v2` launch entry on port 5297.

## User Stories

1. As a first-time visitor, I want to see a turn being played on the home page, so that I understand what the game is before I click Play.
2. As a first-time visitor, I want the narration to appear the way it does in the game, so that the demo is an honest picture of play.
3. As a first-time visitor, I want to see suggested actions appear after the narration, so that I know I can pick an action as well as type one.
4. As a first-time visitor, I want to see stats rise and fall with the story, so that I know my choices have consequences.
5. As a first-time visitor, I want gains shown in green and losses in red, so that I can read the change at a glance, as I would in the game.
6. As a first-time visitor, I want to see an item arrive in my inventory because of the story, so that I know the world reacts to what I do.
7. As a returning player, I want the demo to use the real game screen, so that the site does not promise a look the app does not have.
8. As a visitor in dark mode, I want the page and its screenshots to be dark, so that the page matches my system.
9. As a visitor in light mode, I want the page and its screenshots to be light, so that the page matches my system.
10. As a visitor who picked a theme in the app, I want the site to follow that choice over my system setting, so that my preference holds everywhere.
11. As a visitor who prefers reduced motion, I want the finished turn shown without animation, so that the page does not move under me.
12. As a visitor who prefers reduced motion, I want the theme sweep and pulsing hotspots to stop, so that nothing animates on its own.
13. As a visitor, I want a tour of the game's main features, so that I can see more than one screen.
14. As a visitor, I want the screenshot to change as I scroll through the tour, so that each feature has its picture beside its text.
15. As a visitor, I want small markers on each screenshot that explain what I am looking at, so that a busy screen makes sense.
16. As a keyboard user, I want to reach each hotspot with Tab and read its note on focus, so that the tour works without a mouse.
17. As a visitor, I want to see Inventory as its own tour step, so that I learn I can equip, use, drop and give items.
18. As a visitor, I want to see the five color themes on the same screen, so that I know I can make the game look how I like.
19. As a visitor, I want to drag across the screenshot to compare two themes, so that I can play with the theme picker myself.
20. As a visitor, I want to pick a theme from a row of swatches, so that I can jump straight to one.
21. As a visitor on a phone, I want the hero demo, the tour and the cards to fit my screen without sideways scrolling, so that the page works on mobile.
22. As a visitor on a phone, I want the tour screenshot pinned above the step text, so that I can see the picture while I read.
23. As a visitor, I want to know the game runs in a browser, on desktop and on Android, so that I can pick how to play.
24. As a visitor, I want the download buttons and release version to keep working, so that the new page loses nothing the old one had.
25. As a visitor who came from the store page or a trailer, I want the site's wordmark and accent to match the title card, so that I know I am in the right place.
26. As a signed-in player, I want the account and community pages to use the same accent as the home page, so that the site feels like one product.
27. As a visitor on a slow connection, I want the hero to load first and the tour images to load as I reach them, so that the page is usable quickly.
28. As a visitor, I want the hero demo to start only when I can see it, so that I do not miss the start of the turn.
29. As the maintainer, I want the hero frames to come from the same capture script as the other site screenshots, so that a screenshot retake updates the demo too.
30. As the maintainer, I want the capture to record where each piece of text sits and which colors the theme uses, so that the demo's overlay lines up with the real screen without hand-tuning.
31. As the maintainer, I want the demo turn's text in one data file that both the capture and the page read, so that the captured layout always fits the text that plays over it.
32. As the maintainer, I want the capture to fail when the game screen does not match the scene, so that a broken retake never ships.

## Implementation Decisions

- **Accent.** The gradient runs violet to pink to rose. Dark mode uses the title card's stops (`#a78bfa`, `#f0abfc`, `#fb7185`). Light mode uses darker stops (`#7c3aed`, `#c026d3`, `#e11d48`) so the gradient keeps text contrast on a light background. A solid accent token sits beside the gradient for things a gradient cannot paint: focus rings, outlines, the nav underline's fallback, the account pages' controls. Text on the gradient button uses a dark ink in dark mode and white in light mode.
- **Accent reach.** The landing page, the privacy page, the shared site header and the account and community pages all move from green to the new accent in one change. The account pages' primary color follows the landing page's declared tokens, which the existing palette guard already reads.
- **Wordmark.** "Formamorph" in Baloo 2 at weight 500, letter spacing −0.06em. "morph" carries the gradient, and its five letters step from weight 500 to 800. The goo filter (Gaussian blur, alpha threshold, composite atop the source) gives the rounded look. The blur scales with the font size: the large hero mark and the small header mark each get their own filter strength. The page hosts the Baloo 2 font file itself rather than loading it from Google Fonts, so the site makes no third-party font request.
- **Theme.** Light or dark comes from the shared site theme rule: a stored app theme wins, else the system setting. The page updates live when either changes. The hero and the tour load the frames for the current mode.
- **Hero demo: stage.** The stage is a 1600×900 game capture, cropped to the story column and the side panel, and scaled to the hero's width. Overlay elements sit at the capture's own pixel positions inside the stage, so one scale factor fits text, bars and rings to the screen.
- **Hero demo: scene.** An Emberwatch turn at the Cinder and Crown, with Wenna Tallow present. The player finds a Beer-Stained Barrow Map. Faith drops by 4 and Renown rises by 5. The turn text (action, three narration paragraphs with two lines of dialogue, three suggested actions) lives in one data file the capture and the page share.
- **Hero demo: sequence.** The action types in. The narration words fade in one at a time at a model-like cadence, each over 250 ms with the app's reveal easing, with dialogue in the theme's dialogue color. The suggested actions appear in their rows, left-aligned. The stats then change. After a beat the side panel crossfades to the Inventory tab without the new item, then to the Inventory tab with it, and a ring in the theme's accent pulses around the new row. The turn holds for several seconds and plays again. The demo starts when the hero scrolls into view.
- **Hero demo: stat changes.** The page copies the app's stat bar rule: the accent fill slides from the old value to the new one, and a band covers the span between them, green for a gain and red for a loss, growing from the old value. A signed readout in the same color fades in beside the value. Timings match the app's (500 ms, the app's easing).
- **Hero demo: reduced motion.** The finished turn shows at once: full text, choices, changed stats with their bands, and the Inventory tab with the new item.
- **Capture.** The site screenshot script gains the hero frames. For each of light and dark, in the purple palette, it writes: the Stats tab with the turn text, choices, stat values, fills and descriptors hidden; the Inventory tab before the item arrives; the Inventory tab after it arrives; and the full, unhidden Inventory frame for the tour. Hidden elements keep their space, so the frames keep the app's real layout.
- **Capture layout data.** The capture also writes a small data file the page loads as a script, so it works with no fetch. It holds the boxes of the action line, the narration, each choice and each stat row (value, bar, descriptor), the side panel's box, the new item row's box, and each mode's colors: text, dialogue, action, choice, stat value, fill, descriptor, success and destructive.
- **Capture: prepared game.** The shared demo-game helper learns to place Item Copies on the player, and the save leaves the global stat list empty so only the player's stats show. Each saved state loads in a fresh browser context, because the fixture modules are cached per context. AI calls get an empty successful reply instead of a refusal, so the endpoint error dialog never covers a frame. The capture checks that the scene's text and the new item are on screen before it writes, the same way the gameplay capture already rejects a clipped scene.
- **Ruling Q4 (ticket 01): neutrals stay.** Only the accent, the gradient, the wordmark and the font change. The site keeps its current background, text and border colors; the prototype's purple-tinted neutrals do not ship. The solid accent is the gradient's first stop (`#a78bfa` dark, `#7c3aed` light).
- **Ruling Q5 (ticket 03): hero placement.** The stage sits in the hero under the download note, up to 1100px wide, with the text column unchanged. The hero's blurred background switches to the hero's Stats frame in the current mode, as in the prototype. The logo and wordmark are ticket 01's.
- **Ruling Q6 (ticket 03): ring color.** The new-item ring uses the layout data's `fill` color, the app's accent for the captured palette.
- **Ruling Q7 (tickets 03, 04): changelog.** Ticket 03 writes the home-page entry's fragment; ticket 04 folds the tour into that same entry rather than adding one.
- **Ruling Q8 (ticket 03): pacing.** The prototype's numbers: 900 ms lead-in, 24 ms per action character, 35–90 ms per word, choices 300 ms after the last word, stats 500 ms later, Inventory before at +2.6 s and after at +0.9 s, 6.5 s hold, then loop. The user judges the pacing in a real browser.
- **Ruling Q9 (ticket 04): changelog.** The ticket branch writes no fragment. The spec session rewords ticket 03's home-page entry on main after 04 lands, using wording 04 sends. This carries out Q7.
- **Ruling Q10 (ticket 04): thumbnails.** The gallery thumbnails and their capture step go. The image-versioning test keeps its generic gallery fixture path.
- **Ruling Q11 (ticket 04): palette order.** Purple first, then Graphite, Forest, Rose, Monochrome.
- **Ruling Q12 (ticket 04): platform cards.** Each card links: browser to the web app, desktop to the latest release, Android to the install guide. The footer's download row stays.
- **Ruling Q1 (ticket 02): turn data file.** A plain script in the site's files that sets one global object; the page loads it with a script tag and the capture reads it in a Node sandbox. It holds `action`, `narration`, `choices`, the stat changes (`[{ name, change }]`: Faith −4, Renown +5) and the new item's name. The location and entity stay in the capture.
- **Ruling Q2 (ticket 02): demo-game helper.** Item Copies are a new scene field, placed on the player. The empty AI reply replaces the refusal for every scene. The empty global stat list is opt-in per scene, because the gallery's game screen shows its Stats tab from the world's global stats.
- **Ruling Q3 (ticket 02): outputs.** The hero frames and the layout script live in a `hero` folder under the site's shots, as a scene of their own (`--only hero`) that the default full run includes. The layout data also records each changing stat's min, max and starting value. A hero-only run skips the icon and social-image writes.
- **Tour.** Six steps: Play, Inventory, Library, Create, Your setup, Avatars. Inventory is second. The screenshot is sticky beside the steps on wide screens and pinned above them on narrow ones. The step nearest the middle of the viewport is the current one and sets the screenshot. Each step has two to four hotspots, placed as percentages of the capture.
- **Theme wipe.** On steps with all five palettes, the next palette sweeps across the screenshot behind a gradient bar every few seconds while the frame is on screen and not hovered. Dragging the bar previews the next palette; releasing past the middle keeps it. Swatches pick a palette directly. The Inventory step has one palette, so its wipe and swatches are off.
- **Loading.** The hero's first frame loads eagerly. Tour frames and the other hero frames load lazily.
- **Page structure.** The light/dark onion-skin gallery and its thumbnail strip go. The footer's download row, the release lookup, the deletion notice and the shared header stay as they are.
- **Copy.** The prototype's copy is a draft. Every user-facing string (tagline, tour steps, hotspot notes, platform cards) is written from a facts list per the Writing Guide before it lands.
- **No export shape, version or settings change.** The work touches only the site and the capture tooling.

## Testing Decisions

- A good test drives the page as a visitor does and checks what the visitor would see: pixels, boxes, computed colors and timings. It never reads the page's internal variables.
- **Landing page:** the existing Playwright landing suite, which serves the static site on its own port, is rewritten for the new page. It covers:
  - the theme rule, with a stored theme beating the system setting and live updates on change;
  - the wordmark's gradient split;
  - the hero's word-by-word fade;
  - choices landing inside their rows, left-aligned;
  - the stat bands' color and direction;
  - the inventory switch and ring;
  - the reduced-motion final state;
  - the tour's step-to-screenshot sync and hotspot focus notes;
  - the wipe drag and swatches, off on the Inventory step;
  - the lazy loading of tour frames;
  - the download buttons against a stubbed release.

  Motion claims are sampled per frame in Playwright, as the current suite samples the palette fade.
- **Accent reach:** the existing palette guard in the site pages suite reads the landing page's declared tokens and proves the account pages match. It extends to the new accent tokens.
- **Capture:** the capture's own scene checks, plus its existing verify-only run, prove the frames match the scene. No separate unit tests.
- **Prior art:** the current landing suite (drag against real boxes, opacity sampled while it runs, reduced motion reaching the page, release lookup failing) and the site pages palette guard.

## Out of Scope

- New screenshots for the world editor, scripts, community browsing, voice or the desktop engine. The Create step keeps the world-details screenshot.
- Hero frames in palettes other than purple.
- A real AI call or a playable demo on the page.
- The social-embed image and the favicon.
- The trailer, the store page and the app's own title screen.
- Any change to the app's theme, colors or wordmark.

## Further Notes

- The hero and tour work as a static page with no build step, like the current landing page.
- The prototype's captures ran against a dev server on 5181 because the 5180 server returned "Outdated Optimize Dep" errors on the game route. The capture script should not assume 5180 is healthy.
- In Playwright on this machine, browsers live in `~/.cache/ms-playwright`, so the capture needs `PLAYWRIGHT_BROWSERS_PATH` set there.
