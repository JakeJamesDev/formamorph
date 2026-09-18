# 08: Long Saves, Anchoring Fallback, Mobile, and Close-Out

Status: ready-for-human
Base: c74ac97f
Blocked by: 02, 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

Chat stays fast and steady on a save of a thousand turns, on a browser with no scroll anchoring, and on a
small screen with the on-screen keyboard open. This ticket also ships the changelog entry.

## Acceptance criteria

- [x] Playwright: a save of 1000 turns opens at the bottom with a small mounted count, and a submit still pins.
- [x] Playwright: no programmatic scroll writes occur during a wheel scroll through history with native anchoring on.
- [x] Which engines have no scroll anchoring is verified from a live source, with the source named in the hand-over. On those engines the virtualizer's own scroll correction stays on. Feature detection selects the path, not a user agent string.
- [x] With the on-screen keyboard open on a mobile viewport, the pin and the Jump button use the visual viewport, per the mobile keyboard rule.
- [x] At a narrow width the action and choice bubbles, the icon row, and the Jump button fit with no horizontal scroll.
- [x] Heap and mount time for the 1000-turn case are recorded in the hand-over, measured on real narration with images, not the prototype's short text.
- [x] One In Progress changelog entry in the user-facing bucket, with a bold lead that stands alone.
- [x] Four gates green, and the e2e run time is stated.

## Comments

- **Hand-over (2026-09-18).**
  - **Fixture.** `thousandTurns` (dev router) builds 1000 turns from 15 real Sedge Landing narrations of the
    baseline runs (1.3–1.5k characters each). Every twentieth turn holds a real-sized scene image as a data URL
    (50 images, the four `thumbnails/*.jpg`, 0.45–1.8 MB each).
  - **Engines with no scroll anchoring.** Safari through 26 and every iOS browser. Sources: MDN
    browser-compat-data `css/properties/overflow-anchor.json` (Safari `version_added: "27"`, iOS mirrors it) and
    caniuse `css-overflow-anchor` (Safari 27 `n`, Technology Preview `y`, iOS through 26.6 `n`).
    `hasNativeScrollAnchoring()` reads `CSS.supports('overflow-anchor', 'auto')`; without it the virtualizer
    keeps its own correction.
  - **Measured on the fixture, desktop project, 1280×860, three runs:** 68–102 ms from the Chat press to the
    first mounted turn; 4 turns and 411 nodes mounted at the bottom; heap after GC 103 MB in Pages, 107 MB in
    Chat, and 108 MB in Chat with a scene image decoded in view. The save itself holds the ~100 MB; Chat adds
    about 4 MB. The mount time is taken at the bottom, where no image turn is mounted.
  - **Guards proven by reinstating the bug:** correction always off with no native anchoring moves the reading
    line 433 px on one step; correction on with native anchoring makes 32 code scroll writes in 80 wheel ticks;
    a window-fixed Jump button sits at 800 px under a 482 px visible area; hidden scene images fail the image check; a wide icon-row label overflows 55 px
    at 320 px; overscan 20 mounts 21 turns.
  - **Mobile keyboard.** No code change was needed: the app frame follows the visual viewport (`.app-viewport`),
    and the pin, the minimum height, and the Jump button all measure the scroller inside it. The e2e shrinks and
    pans (`offsetTop`) a fake visual viewport to prove it; a real on-screen keyboard still needs a device check.
  - **E2E run:** `chat-pin`, `chat-barrier` and `chat-scale` together, 24 passed, 2.9 min; `chat-scale` alone
    40 s.
  - **Named, not done:** the Chat e2e specs (`chat-pin`, `chat-barrier`, `chat-scale`) each carry their own
    open, submit, Jump, and geometry helpers; a shared `e2e/chat.ts` would remove the copies.
