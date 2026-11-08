# 01: Accent and Wordmark

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Owns the accent tokens and the wordmark that tickets 03 and 04 use.

## What to build

Every formamorph.ai page moves from the green accent to the violet-to-rose gradient, and the wordmark matches the title card. The landing hero and the shared site header show "Forma" plain and "morph" in the gradient, in Baloo 2, with each "morph" letter heavier than the last and the goo filter rounding the shapes. The Play button wears the gradient. Focus rings, outlines and the account and community pages' controls use the solid accent. Light mode uses the darker gradient stops. The font file is hosted with the site.

The spec's Implementation Decisions hold the color stops, the weights, the filter and the reach.

## Acceptance criteria

- [ ] The landing page, the privacy page and the shared site header declare the gradient and solid accent tokens for light and dark, with the stops the spec names; no green accent remains on any site page.
- [ ] The hero and header wordmarks render "Forma" in the text color and "morph" in the gradient, with letter weights 500, 575, 650, 725, 800; the header mark uses its own lighter filter and stays sharp.
- [ ] Baloo 2 loads from the site's own files; the page makes no request to a font host.
- [ ] The account and community pages' primary color matches the landing page's accent in both themes; the site-pages palette guard proves it.
- [ ] Frames: `.scratch/frames/accent-landing-dark.png`, `.scratch/frames/accent-landing-light.png` (1440 wide) and `.scratch/frames/accent-account-dark.png` (1440 wide) show the hero wordmark, the Play button and an account page.
- [ ] Docs the change makes stale are updated (the e2e README's palette guard note).

For you: the wordmark next to the title card art at hero size, both themes.
