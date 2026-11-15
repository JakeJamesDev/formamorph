# 15: Settings Order and Offer Preview

Status: ready-for-human
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Changes from the user's review of the Settings rows and the first-time offer.

- **Settings rows (Q64, Q66):**
  - Order in Display › Accessibility: the Character Mentions toggle, the model choice (Auto, Big, Small), then Contribute Corrections.
  - Contribute Corrections shows only while Character Mentions is on and the player is signed in. It is disabled with a reason when the player is not age-attested.
  - "Reset Size & Spacing" moves directly under Line Spacing.
  - The review screenshot showed a tall empty gap under the Mentions Model row. Find and fix its cause.
- **Ask once (Q64):** Contribute Corrections stays off by default. The player is asked once, yes or no:
  - in the first-time offer, when signed in and age-attested;
  - otherwise at their first correction made while signed in and age-attested.
  - The answer sets the per-account opt-in (Q60), and the question never comes back.
- **Offer preview (Q65):**
  - The offer card drops Morphie. Its picture is a preview of the feature: a hand-made passage with three cast members and the player conversing, every quote speaker-colored, the player's in their Quote Color.
  - It renders through the real narration renderer with a fixed reading and fixed entities, never the model, so it is always right.
  - A "What's this?" control opens the preview larger.
  - The passage is written for this preview, never taken from gold or real narration (Q33).
- **Copy:** from the Writing Guide, including the ask-once question.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [x] The three rows show in the stated order. Contribute Corrections is hidden when the feature is off or the player is signed out. (`CharacterMentionsRows.test.tsx` order and hidden tests, mutation-checked; Playwright row reads at 1366, 700 and phone width.)
- [x] Reset Size & Spacing sits under Line Spacing. (Playwright row reads: Line Spacing, then Reset, in all six runs.)
- [x] The ask-once question shows once per account, in the offer or at the first correction, and sets the opt-in from the answer. Tests cover both paths and prove nothing is sent before a yes. (`useContributeAsk.test.tsx` through the real mention card; `useDemoAIOffer.test.tsx` "the ask-once question"; each guard mutation-checked.)
- [x] The offer preview uses no model output. A test renders it with the model store absent. (`MentionsPreview.test.tsx` mocks the store and host modules to throw on load.)
- [x] Frames for the user's approval: the offer card, the open preview, and the Settings rows, in light and dark, desktop and mobile. (See Landed.)

## Landed

Built to Q69 (spec session ruling): the offer asks after Turn On and stays open until answered; at a correction the card swaps to the question and closing it unanswered counts as no; a Settings change also counts as the answer.

**Not verified**

- The "tall empty gap under the Mentions Model row" bullet is dropped (spec session's call). The space under the labels is the download bar row while the model downloads, plus the model help line when it wraps (`settings-rows-narrow-dark.png`). No layout bug.
- The question at a correction is tested in jsdom, not framed in a live game: no signed-in, attested fixture runs beside a game fixture.

**For you**

- Approve the new visual patterns (Q65): the preview in Morphie's place, the question in the card, and the larger preview dialog.
  - Offer card: `.scratch/character-mentions-15/frames/offer-card-desktop-light.png`, `offer-card-desktop-dark.png`, `offer-card-mobile-light.png`, `offer-card-mobile-dark.png`
  - After Turn On, with the question: `offer-question-desktop-light.png`, `offer-question-desktop-dark.png`, `offer-question-mobile-light.png`, `offer-question-mobile-dark.png`
  - Open preview: `offer-preview-open-desktop-light.png`, `offer-preview-open-desktop-dark.png`, `offer-preview-open-mobile-light.png`, `offer-preview-open-mobile-dark.png`
  - Settings rows: `settings-rows-desktop-light.png`, `settings-rows-desktop-dark.png`, `settings-rows-mobile-light.png`, `settings-rows-mobile-dark.png`
- Read the question copy: "Each time you correct a name or quote, the whole passage goes to Formamorph to help train the model. Accepted passages are kept. You can change this in Settings." Its retention wording still waits on the legal check (Q15).
- Dev routes: `#dev?view=gameViewer&fixture=whiteRoom&modal=storyCard&tab=mentions`, `tab=mentionsAsk`, `tab=mentionsPreview`.
