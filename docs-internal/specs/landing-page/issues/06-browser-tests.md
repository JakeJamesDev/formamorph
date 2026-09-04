# 06 — Browser tests for the page

Status: done
Spec: ../spec.md
Blocked by: 01

## Task

A Playwright spec in the repo's existing e2e suite, served from the tracked site directory.

- Gallery renders and the thumbnails switch screens.
- The divider drags.
- The palette fade advances with the old layer held opaque mid-fade.
- Download buttons resolve from a stubbed release, and fall back when the API fails.
- `prefers-reduced-motion` disables the slideshow.
- A mobile viewport lays out with no horizontal overflow.

## Done

- `npm run test:e2e` green, including the app specs that already existed.
- Each new guard proven to fail when its contract is mutated.

## Comments

**Implemented.** `e2e/landing.spec.ts`, served by `scripts/serveSite.mjs` — a second `webServer` entry in `playwright.config.ts` on port 5185, beside the app's dev server on 5183. The landing page shares no code with the app, so it gets its own server rather than a route in the bundle.

Nine tests: gallery structure, asset resolution, thumbnail switching, divider drag, the fade trace, reduced motion, both download paths, and viewport fit. Four are desktop-only (`test.skip` on the project name) because they are viewport-independent; the rest run on both, so the phone profile covers the layout and the download paths as well.

The fade guard is the one worth reading. It samples every layer's computed opacity across a whole tick and the fade after it, then asserts the incoming layer was caught mid-climb at least four times **and the outgoing layer read exactly 1 on every one of those samples**. That is the design decision made executable: a true cross-fade passes both layers through half opacity, which is the brightness dip the design rejected.

### Evidence

`npm run test:e2e` (whole suite, both projects): **149 passed, 49 skipped, 8.8 min.** The landing file alone: **14 passed, 4 skipped, 20.2 s.**

Every guard was proven to fail against the contract it watches:

| Guard | Mutation | Result |
| --- | --- | --- |
| fade holds the outgoing layer opaque | Dropped the covered layer at once instead of after `FADE_MS` — a true cross-fade | bites |
| reduced motion parks the slideshow | Removed the `matchMedia` guard | bites |
| downloads fall back | Fallback href changed to `#` | bites |
| the divider drags | Removed the `pointermove` handler | bites |
| both theme stacks render | Emptied the dark `topwrap` | bites |
| a thumbnail switches screens | Made the click handler inert | bites |
| the page fits its viewport | `flex-wrap: nowrap` on the thumbnail row | bites (on `mobile`, which is the viewport it protects) |
| every named asset is served | Reinstated the shipped `og.png`/`og.jpg` bug, plus a favicon typo, a bad hero path, and a renamed thumbnail dir | bites, 4/4 |

**One guard could not fail, and that was a real finding.** The viewport-fit test read `scrollWidth` vs `clientWidth` while `body` carried `overflow-x: hidden` — which hides overflow rather than preventing it, so no mutation could make the test go red. Removing that one declaration is what made the guard bite.

**The asset guard exists because `/code-review` found the bug it now watches.** `og:image` and `twitter:image` pointed at `/site/og.png` while the capture writes `og.jpg`, so every shared link would have unfurled with no image — invisible on screen, and no other test fetched those URLs. Fixed, and the guard added in the same pass.
