# 01: Accent and Wordmark

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Owns the accent tokens and the wordmark that tickets 03 and 04 use.

## What to build

Every formamorph.ai page moves from the green accent to the violet-to-rose gradient, and the wordmark matches the title card. The landing hero and the shared site header show "Forma" plain and "morph" in the gradient, in Baloo 2, with each "morph" letter heavier than the last and the goo filter rounding the shapes. The Play button wears the gradient. Focus rings, outlines and the account and community pages' controls use the solid accent. Light mode uses the darker gradient stops. The font file is hosted with the site.

The spec's Implementation Decisions hold the color stops, the weights, the filter and the reach.

## Acceptance criteria

- [x] The landing page, the privacy page and the shared site header declare the gradient and solid accent tokens for light and dark, with the stops the spec names; no green accent remains on any site page. (site-pages tests "the light/dark landing, privacy and header tokens carry the gradient stops"; grep of `hosting/` and `site/` for the old greens)
- [x] The hero and header wordmarks render "Forma" in the text color and "morph" in the gradient, with letter weights 500, 575, 650, 725, 800; the header mark uses its own lighter filter and stays sharp. (test "the wordmark splits plain Forma from a heavier-by-letter gradient morph")
- [x] Baloo 2 loads from the site's own files; the page makes no request to a font host. (same test: `document.fonts.check` and the request host list)
- [x] The account and community pages' primary color matches the landing page's accent in both themes; the site-pages palette guard proves it. (existing guard tests, green; they read `--accent` off the landing page)
- [x] Frames: `.scratch/frames/accent-landing-dark.png`, `.scratch/frames/accent-landing-light.png` (1440 wide) and `.scratch/frames/accent-account-dark.png` (1440 wide) show the hero wordmark, the Play button and an account page. (viewed)
- [x] Docs the change makes stale are updated (the e2e README's palette guard note).

For you: the wordmark next to the title card art at hero size, both themes.

## Landed

**Not verified**
- The community pages' primary color has no frame or test of its own. It shares `site.css` with the sign-in page, which the guard covers.

**For you**
- The wordmark next to the title card art at hero size, both themes: `.scratch/landing-showcase-01/frames/accent-landing-dark.png`, `.scratch/landing-showcase-01/frames/accent-landing-light.png`.
- The sign-in page with the violet controls: `.scratch/landing-showcase-01/frames/accent-account-dark.png`.
