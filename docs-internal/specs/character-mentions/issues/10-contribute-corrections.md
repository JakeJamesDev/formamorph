# 10: Contribute Corrections

Status: ready-for-agent
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
  - the original clusters and the correction.
- **Staff tab:** a review tab in the admin panel, beside Review and Reports. It shows the passage with the original and corrected links, and accept and reject buttons.
- **Copy:** write the opt-in copy from the Writing Guide.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [ ] With the setting off or signed out, a correction sends nothing. A network-level test checks this.
- [ ] With the setting on, a correction posts once with the full payload.
- [ ] Staff can accept and reject from the tab, and the counts update.
- [ ] Frames: `.scratch/frames/contribute-optin.png` and `staff-review-tab.png`, light and dark.

For you: before this ships, get the legal check on keeping passages after account deletion (spec Q15).
For you: approve the opt-in copy.
