# 11: First-Time Offer

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

## What to build

The first-time flow offers Character Mentions once, through the existing earned-card mechanism.

- **Card:** one new card. It shows only when AI Language is English and the feature is off. It is due after 3 settled new player turns on any AI, and it yields to a Formamorph AI card due on the same turn (Q52). While it shows, a Formamorph AI card waits for the first settled turn after it closes (Q55). Shown and accepted are recorded on the device only; there is no funnel step.
- **Accept:** starts the same download as the Settings toggle. The card shows the download bar until the model is ready, then closes.
- **Decline:** marks the card as seen.
- **Copy:** write it from the Writing Guide.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [x] The card shows once, and never again after accept or decline. `useMentionsStoryCard` tests "shows once at 3 settled turns…" and "never shows again after Not Now…"; the seen record is written on first show.
- [x] It never shows for a non-English AI Language, or when the feature is already on. `useMentionsStoryCard` tests "never shows for an AI Language other than English" and "…already on"; `mentionsCardDue` cases.
- [x] Accept starts the download and records the accept on the device. No funnel step is sent. Test "Turn On turns the setting on, records the accept…": it flips the same setting as the Settings toggle, and `funnelPosts()` stays empty. The slot rules have tests too (`useStoryCards`, Q52 and Q55).
- [x] Frames: light and dark, at desktop (1440×900) and mobile (375×812) width, stored as four files: `.scratch/character-mentions-11/frames/mentions-offer-{desktop,mobile}-{light,dark}.png`.

## Landed

**Not verified**
- The real download in the card. The frames and tests use the dev manifest and a stubbed controller state, so the progress bar was not watched filling against the published manifest.

**For you**
- The card copy and the Morphie art on a non-Formamorph-AI offer: `.scratch/character-mentions-11/frames/mentions-offer-desktop-dark.png`, or `#dev?view=gameViewer&fixture=whiteRoom&modal=storyCard&tab=mentions`.
- Turn On on a real connection: the card should show the MB bar, then close when the model is ready.
