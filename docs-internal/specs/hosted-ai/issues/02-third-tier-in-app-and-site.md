# 02: Third Tier in the App and Site

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a known type and label map gain one key; the only judgment call is the flair visual, which goes to the user.

**What to build:** the client's Supporter tier type and the Supporter flair map know the third tier key, with the same key name as ticket 01. An account on the new tier shows Supporter Flair in the app and on the site, and sorts first on the Supporters wall page. Its label comes from the one label map, under a working label until the user names the tier. Its flair color is a new visual pattern: propose one built from existing design tokens and leave the approval to the user.

- [x] The tier type and label map include the new key; a type check fails on any switch that misses it. (`Record<SupporterTier, …>` maps in `supporterFlair.ts`, `SupporterBadge.tsx`, the reference swatches; typecheck)
- [x] An account on the new tier renders Supporter Flair in the app and on the site (component tests). (`supporterFlairDisplay.test.tsx` per tier; `SupportersPage.test.tsx` name color)
- [x] The Supporters wall page orders the new tier first. (`SupportersPage.test.tsx` heading order)
- [x] Frames of the badge and ring in both themes at desktop width: `.scratch/frames/top-tier-flair-light.png`, `.scratch/frames/top-tier-flair-dark.png`. (Playwright, 1440 wide)
- [x] The design-system showcase shows the new tier's flair. (Supporter Flair reference, tab `supporter-flair`)

For you: approve or replace the new tier's flair color and badge style (frames above, and the design-system showcase).
For you: name the new tier; the label lives in the Supporter flair label map.

## Landed

Not verified: the server sort order of the wall (ticket 01 owns it; the page only splits rows).

For you:
- Approve or replace the new tier's flair: amber `--supporter-top` (light `40 95% 18%`, dark `45 90% 78%`), heart-handshake icon, outline plus a soft outer halo. Frames: `.scratch/hosted-ai-02/frames/top-tier-flair-light.png`, `.scratch/hosted-ai-02/frames/top-tier-flair-dark.png`; also the design-system showcase, Supporter Flair tab.
- Name the new tier; the working label "Supporter++" lives in the Supporter flair label map.
