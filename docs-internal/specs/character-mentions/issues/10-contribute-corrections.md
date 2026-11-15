# 10: Contribute Corrections

Status: ready-for-human
Blocked by: 08, 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A signed-in adult player can send corrections to the training corpus, and staff review them.

- **Setting:** "Contribute corrections" is off by default.
  - Only signed-in, age-attested accounts can turn it on.
  - The opt-in copy says the whole passage is sent and kept.
  - Turning it off stops future sends.
- **Sending:** with the setting on, each correction also sends:
  - the full passage;
  - the model id and version;
  - the original clusters with their entity ids, and every correction for that turn so far (spec Q35, Q36).
- **Staff tab:** a review tab in the admin panel, beside Review and Reports. It shows the passage with the original and corrected links, and accept and reject buttons.
- **Copy:** write the opt-in copy from the Writing Guide.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [x] With the setting off or signed out, a correction sends nothing. A network-level test checks this. (`correctionContribution.test.tsx` stubs `fetch`: setting off, signed out, unattested, and another account than the one that opted in (Q60) all send nothing.)
- [x] With the setting on, a correction posts once with the full payload. ("posts once with the full passage, the model, the clusters and the corrections"; the body matches the server's `readSubmission`.)
- [x] Staff can accept and reject from the tab, and the counts update. (`MentionsTab.test.tsx` through the real `AdminPanelDialog`: "Mentions (2)" becomes "Mentions (1)" after each.)
- [x] Frames: `.scratch/frames/contribute-optin.png` and `staff-review-tab.png`, light and dark. (Stored as `contribute-optin-light.png`, `-dark.png`, `-info.png` (the ⓘ copy), `-signed-out.png`, and `staff-review-tab-light.png`, `-dark.png`.)

## Landed

**Not verified**
- Every criterion is ticked. Outside them: the send call site in GameViewer (`correctMention`) is untested. The gate and payload are tested in `contributeTurn`, but nothing drives a real "Wrong character?" pick through GameViewer to the network. Two quick corrections before a render read a ref; checked by reading only.

**For you**
- Export shape: saves now carry `clusters` and `clusterEntities` on each Character Mentions reading (additive; unshipped). Readings made before this send nothing.
- For you: before this ships, get the legal check on keeping passages after account deletion (spec Q15).
- For you: approve the opt-in copy. See `.scratch/character-mentions-10/frames/contribute-optin-light.png` and `.scratch/character-mentions-10/frames/contribute-optin-info.png`. The ⓘ says "Staff review each passage", which tells players a review exists.
- The staff tab: `.scratch/character-mentions-10/frames/staff-review-tab-light.png`. Entity ids show raw, since staff have no copy of the world. The corrected spans use a highlight that is new to the admin panel.
- Try it live: `#dev?view=mainMenu&modal=adminPanel&tab=moderation&subtab=mentions&fixture=review` and `#dev?view=mainMenu&modal=settings&tab=display&fixture=contribute`.
