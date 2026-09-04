# 01 — The landing page itself

Status: done
Spec: ../spec.md

## Task

Translate the finalized prototype (variant A, `.scratch/landing-page/prototype/landing-a.html`) into
production files under `hosting/`.

- `hosting/index.html` — hero over blurred library art, the settled three-sentence tagline verbatim,
  Play + Download buttons, onion-skin gallery with the palette slideshow, minimal footer.
- Images are separate files under `hosting/site/`, not data URIs. Lazy-load everything except the
  first visible pair.
- Fade stays IN-only: the covered layer keeps `opacity: 1` until the incoming one lands.
- The slideshow pauses while the divider is dragged, and never starts under `prefers-reduced-motion`.
- Downloads resolve client-side from the GitHub releases API, with the releases page as fallback.
- SEO/meta: title, description, canonical, Open Graph + Twitter card with one gallery screenshot,
  favicon reusing the app icon.
- The layout works on a phone.

## Done

- Page renders with no console errors at desktop and mobile viewports.
- No app code, no version, no export-shape change.

## Comments

**Implemented.** `hosting/index.html` — variant A translated to production, images as separate files under `hosting/site/`.

Changes from the prototype, all deliberate:

- **The slideshow timer moved to the gallery, not the skin.** Rendered screens are cached so switching back costs no second download, and a cached-but-detached skin would have cleared its own timer and never restarted it. One gallery-level interval drives whichever skin is current.
- **`prefers-reduced-motion` gates the interval entirely**, and also drops the CSS transition.
- **Lazy loading:** the first screen's first palette is `fetchpriority="high"`; every other layer is `loading="lazy" decoding="async"`. A visitor who never scrolls to the gallery downloads two images, not ten. Thumbnails are their own 300px-wide files rather than the full screenshots.
- **`overflow-x:hidden` on `body` was removed.** It made the mobile-overflow guard unable to fail — see ticket 06.
- Links are root-relative (`/play/`), so the page is testable off a local server and correct in production.

### Evidence

| Claim | How it was checked | Result |
| --- | --- | --- |
| Renders with no console errors | Playwright at 1280x860 and 375x812 | 0 page errors, 0 console errors, both |
| Gallery geometry is right | DOM read in the live preview | skin 1052x592, image 1051x590, natural 1280x720, 10 layers (5 light + 5 dark) |
| No horizontal overflow | `scrollWidth` vs `clientWidth` at both viewports | equal at 1265 (desktop) and at 375 (mobile) |
| Behavior | `e2e/landing.spec.ts` | 14 passed, 4 skipped by design, 20.2 s |
| Every asset the page names is served | New spec fetches favicon, hero background, all thumbnails, and the social card | 8+ URLs, all 200 |

No app code, no version, no export-shape change.
