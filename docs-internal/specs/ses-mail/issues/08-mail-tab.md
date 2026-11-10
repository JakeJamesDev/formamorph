# 08: Mail Tab

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/ses-mail/spec.md` (Client; Q11)

Model rationale: one read-only tab built from the Usage tab's existing tiles and tables.

## What to build

The Admin Panel gains a Mail tab, for admins only. It shows tiles for mail sent, delivered, bounced and complaints, the 7-day bounce and complaint rates next to Amazon's limits, the SES account status, and the quota used in the last 24 hours. SES counts quota over a rolling 24 hours, so the tab never says "today". Below the tiles, a table lists each day's counts, with hard and soft bounces in separate columns. The bounce tile and the bounce rate use hard bounces. The tab uses the Usage tab's tile and table patterns and adds no new visual pattern.

This ticket owns the client's mail-report service.

## Acceptance criteria

- [x] The Mail tab shows for an admin and is absent for a moderator. (`AdminPanelDialog.test.tsx`: carries the mail report; moderator sees no Mail tab and lands on Users)
- [x] The tiles and the per-day table show the values the server returned. (`MailTab.test.tsx`: sums the shown days; lists each day; client types checked against `buildMailReport`)
- [x] Each rate shows Amazon's review limit beside it, and reads as not yet measured when the volume is under the floor. (`MailTab.test.tsx`: limits beside each rate; not yet measured under the floor, limit still shown)
- [x] A non-healthy SES status is shown as text, not by color alone. (`MailTab.test.tsx`: the SES status group)
- [x] A failed read shows an error state with the reason, like the Usage tab. (`MailTab.test.tsx`: shows the reason when the read fails)
- [x] No request is left running after the panel closes. (`MailTab.test.tsx`: cancels on close and on tab change; test fails with the abort removed)
- [x] The tab has a dev-router entry with a healthy sample and an under-review sample. (`tab=mail&fixture=mail` and `fixture=mailReview`; `devRouter.test.ts` ledger passes)
- [x] Frames, light and dark, at a realistic desktop width: `.scratch/ses-mail-08/frames/mail-tab-<state>-<theme>.png` for healthy and under review. (browser pane, 1280x900 emulation, dev-router fixtures)

For you: open the Mail tab after a day of real mail and check the numbers against the SES console.

## Landed

**Not verified**
- Live route: the tab ran only against the dev fixtures, not a deployed server.

**For you**
- Open the Mail tab after a day of real mail and check the numbers against the SES console.
- Frames: `.scratch/ses-mail-08/frames/mail-tab-healthy-dark.png`, `mail-tab-healthy-light.png`, `mail-tab-review-dark.png`, `mail-tab-review-light.png`. The files are JPEG data saved under a `.png` name.
- No changelog entry: the tab is a staff tool.
