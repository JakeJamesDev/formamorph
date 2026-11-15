# 15: Settings Order and Offer Preview

Status: ready-for-agent
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

- [ ] The three rows show in the stated order. Contribute Corrections is hidden when the feature is off or the player is signed out.
- [ ] Reset Size & Spacing sits under Line Spacing.
- [ ] The ask-once question shows once per account, in the offer or at the first correction, and sets the opt-in from the answer. Tests cover both paths and prove nothing is sent before a yes.
- [ ] The offer preview uses no model output. A test renders it with the model store absent.
- [ ] Frames for the user's approval: the offer card, the open preview, and the Settings rows, in light and dark, desktop and mobile.
