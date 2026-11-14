# 11: First-Time Offer

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

## What to build

The first-time flow offers Character Mentions once, through the existing earned-card mechanism.

- **Card:** one new card with its own funnel step. It shows only when AI Language is English and the feature is off.
- **Accept:** starts the same download as the Settings toggle.
- **Decline:** marks the card as seen.
- **Copy:** write it from the Writing Guide.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [ ] The card shows once, and never again after accept or decline.
- [ ] It never shows for a non-English AI Language, or when the feature is already on.
- [ ] Accept starts the download, and the funnel step is sent once.
- [ ] Frames: `.scratch/frames/mentions-offer.png`, light and dark, at desktop and mobile width.
