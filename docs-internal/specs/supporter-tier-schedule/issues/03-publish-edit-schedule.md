# 03: Client: Set and edit a tier schedule

Status: ready-for-human
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: form fields and an edit control on existing admin surfaces, against a schedule type that ticket 02 owns.

## Parent

[spec.md](../spec.md) — Supporter Tier Schedule.

## What to build

When an admin publishes a new Supporter-only Mascot or World listing, the Publish dialog shows one days field per tier, highest first, and a switch to go public after the last stage. An empty field skips that stage (Q3, Q4). The opening date of each stage and the public date show under the fields as the admin types. The admin edit control on the card and in the details window edits the same schedule, including moving a passed stage back into the future (Q8). The server's refusals for an out-of-order schedule or a past public date show to the admin.

## Acceptance criteria

- [x] The Publish dialog's per-tier fields and public switch send the schedule on create. Empty fields send no stage. (PublishModal.supporter.test.tsx "the schedule fields": days per tier, skipped stage, go-public off)
- [x] The computed dates under the fields match what the server stores. (supporterScheduleEdit.test.ts "planSchedule", against the server's `readDays` math, read in `supporterSchedule.js`)
- [x] The card and details edit control loads the current schedule, saves a change, and shows a server refusal. (SupporterScheduleDialog.test.tsx; WorldStorageService.supporterSchedule.test.ts; the card and details buttons in RemoteWorldCard.supporterEnd.test.tsx and RemoteWorldDetailsModal.supporterOnly.test.tsx)
- [x] The fields show only for Mascot and World listings (Q9). (PublishModal.supporter.test.tsx "is absent for a kind that cannot be Supporter-only")
- [x] Copy passes the Writing Guide (`copy-sweep` skill). (`npm run copy:sweep` reports nothing on the new files)
- [x] Frames of the Publish dialog's schedule fields and the edit control, light and dark, at 1280 wide: `.scratch/frames/publish-schedule-light.png`, `.scratch/frames/publish-schedule-dark.png`, `.scratch/frames/edit-schedule-light.png`, `.scratch/frames/edit-schedule-dark.png`. (Playwright, 1280 viewport; each frame crops the dialog)
- [ ] A changelog fragment in `docs-internal/changelog.d/`, or a fold-in to ticket 02's fragment.

## Landed

**Not verified**
- The changelog fragment: not written. Supporter-only marking is a staff tool, and the project's changelog rule gives staff tools no entry.
- A real save against the server: tests stub fetch, and the dev route's Save is a no-op.

**For you**
- The Publish dialog's schedule fields on a new Mascot or World as an admin: the labels ("Beacon Days"), the hints ("Skipped. Opens …") and the "Go Public After" switch.
- The Supporter-Only Schedule dialog from the card and the details window: the "Schedule" button, the "Opens with the public date" and "Never opens" hints.
- Saving an unchanged legacy listing (no stages) makes its lower tiers open at the public date, not at publish.
