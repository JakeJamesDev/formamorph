# 13: Mention Card Portrait

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The mention card shows the entity's portrait in place of the initial (spec Q51).

- **Look:** the user picked "Larger portrait" from a mock with real Emberwatch portraits: a 48×56 rounded crop, anchored to the top of the image. The initial stays as the fallback when there is no visible image. Mock: `.scratch/character-mentions-07/frames/mention-card-image-both.jpg` (bottom card in each panel).
- **Player View:** the Player View entity gains the image the player can see. The Player View module is shared with Formaquestion, so the new field must not change what Formaquestion reads or sends.
- **Visibility:** any entity with a Player View row shows its image, met or not, but only when the image's `requires` gate passes (Image Visibility Rules). A failed gate shows the initial.
- **Design System:** update the mention-card showcase entry.
- **Changelog:** fold into the hover-card entry if it is still unreleased.

## Acceptance criteria

- [x] The card shows the portrait for a met entity and for a seen stranger, and the initial when there is no image. `MentionCards.portrait.test.tsx` (first two cases); DOM read in the showcase: 48×56, `object-position: 50% 0%`.
- [x] An image whose `requires` gate fails never reaches the card. The test runs through the Player View and is proved by reinstating the leak. "never shows an image whose rule fails…" builds rows with `buildPlayerView` under a real gate input; with the gate bypassed it failed (`Expected "data:wolf-day", Received "data:wolf-night"`).
- [x] Formaquestion's Player View output is unchanged. Only the card's build passes a `gate`; Formaquestion's calls pass none, so their rows carry no `image`. Tests "carries no image without a gate" and "pages the same view with or without images".
- [x] Frames: light, dark and mobile, with and without an image. `.scratch/character-mentions-13/frames/mention-card-portrait-both.jpg` (light and dark, initial and portrait) and `mention-card-portrait-mobile.jpg`.

## Landed

**Not verified**

- None. The frames were taken before the showcase's second card went back from a test fixture to "the courier"; the card component is the same, and a DOM read confirmed the courier's 48×56 portrait in both themes.

**For you**

- The changelog has a new entry under Character Mentions, not a fold into the hover-card entry: fragments can't edit an existing line. Merge them by hand if you prefer one entry.
- The card reads the current turn's image rules, so when you page back, the entity panel (paged turn) and the card (now, Q46) can show different pictures.
- Look at a card with a real world portrait: Emberwatch in play, Character Mentions on, hover a name.
