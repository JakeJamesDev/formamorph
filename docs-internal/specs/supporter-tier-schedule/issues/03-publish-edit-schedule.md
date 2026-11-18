# 03: Client: Set and edit a tier schedule

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: form fields and an edit control on existing admin surfaces, against a schedule type that ticket 02 owns.

## Parent

[spec.md](../spec.md) — Supporter Tier Schedule.

## What to build

When an admin publishes a new Supporter-only Mascot or World listing, the Publish dialog shows one days field per tier, highest first, and a switch to go public after the last stage. An empty field skips that stage (Q3, Q4). The opening date of each stage and the public date show under the fields as the admin types. The admin edit control on the card and in the details window edits the same schedule, including moving a passed stage back into the future (Q8). The server's refusals for an out-of-order schedule or a past public date show to the admin.

## Acceptance criteria

- [ ] The Publish dialog's per-tier fields and public switch send the schedule on create. Empty fields send no stage.
- [ ] The computed dates under the fields match what the server stores.
- [ ] The card and details edit control loads the current schedule, saves a change, and shows a server refusal.
- [ ] The fields show only for Mascot and World listings (Q9).
- [ ] Copy passes the Writing Guide (`copy-sweep` skill).
- [ ] Frames of the Publish dialog's schedule fields and the edit control, light and dark, at 1280 wide: `.scratch/frames/publish-schedule-light.png`, `.scratch/frames/publish-schedule-dark.png`, `.scratch/frames/edit-schedule-light.png`, `.scratch/frames/edit-schedule-dark.png`.
- [ ] A changelog fragment in `docs-internal/changelog.d/`, or a fold-in to ticket 02's fragment.
