# 03: Hero Live Turn

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Under the landing hero's call to action, the captured game screen plays the turn:
- the action types in;
- narration words fade in one at a time, with dialogue in its color;
- the suggested actions appear left-aligned in their rows;
- Faith drops with a red band and a `−4` readout, and Renown rises with a green band and a `+5` readout;
- the side panel crossfades to Inventory, and the new map appears with a pulsing ring.

The turn holds and loops. It starts when the hero is in view, follows the site theme live, and shows the finished turn at once under reduced motion. The stage is cropped to the story column and side panel and scales to the hero's width.

The prototype (`.scratch/landing-v2/index.html`, untracked) is the reference build. The spec's Implementation Decisions hold the sequence, the stat band rule and its timings. Copy follows the Writing Guide.

## Acceptance criteria

- [x] Each narration word fades from 0 to full opacity over about 250 ms, one after another; no caret is drawn (per-frame Playwright samples). `landing hero turn › narration words fade in one after another…`: rAF samples of six words, 150–450 ms per fade, ordered starts, no stray element or pseudo-content.
- [x] Each choice's text sits inside its captured row, left-aligned (box reads in the landing suite). `…each choice sits inside its captured row`: text range vs the layout's row and text boxes.
- [x] The Faith band is red and covers 46–50; the Renown band is green and covers 5–10; both readouts show in the matching color (computed colors and boxes). `…Faith drops with a red band…`, both themes.
- [x] At the end of the turn the side panel shows the Inventory frame, clipped to the panel, with the ring around the new item row. `…the played turn ends on the Inventory frame…`: a full played turn, hit tests in and out of the panel, ring box around the row.
- [x] Under reduced motion the finished turn shows with no transition; switching the site theme swaps every hero frame and color without a reload. `…reduced motion shows the finished turn…` and `…a site theme switch swaps every hero frame…`.
- [x] The demo does not start until the hero scrolls into view, and the first frame loads eagerly. `…the demo waits for the hero to scroll into view…`: nothing plays for 2.5 s off screen; the base frame has `fetchpriority=high` and no `loading=lazy`.
- [x] Frames: `.scratch/frames/hero-dark-1440.png`, `.scratch/frames/hero-light-1440.png` and `.scratch/frames/hero-dark-375.png`, each showing the finished turn. Taken under reduced motion.
- [x] The page has no horizontal scroll at 375 wide. `landing page › the page fits its viewport` on the mobile project, and the 375 frame run (scroll width 375).

## Landed

**Not verified**
- Narration wrap on other platforms: the overlay uses the app's system font stack, so a wider system font can wrap a paragraph to an extra line and overlap the next. Checked on Windows only.

**For you**
- The turn's pacing (typing, word fade, stat change, inventory switch, hold) in a real browser.
- The light Inventory frame's section headers (Wanderer, The Cinder and Crown) render very faint in ticket 02's capture: `.scratch/landing-showcase-03/frames/hero-light-1440.png`.
- Frames: `.scratch/landing-showcase-03/frames/hero-dark-1440.png`, `.scratch/landing-showcase-03/frames/hero-light-1440.png`, `.scratch/landing-showcase-03/frames/hero-dark-375.png`.
