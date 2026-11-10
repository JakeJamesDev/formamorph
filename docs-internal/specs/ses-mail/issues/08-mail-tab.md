# 08: Mail Tab

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/ses-mail/spec.md` (Client; Q11)

Model rationale: one read-only tab built from the Usage tab's existing tiles and tables.

## What to build

The Admin Panel gains a Mail tab, for admins only. It shows tiles for mail sent, delivered, bounced and complaints, the 7-day bounce and complaint rates next to Amazon's limits, the SES account status, and the quota used in the last 24 hours. SES counts quota over a rolling 24 hours, so the tab never says "today". Below the tiles, a table lists each day's counts, with hard and soft bounces in separate columns. The bounce tile and the bounce rate use hard bounces. The tab uses the Usage tab's tile and table patterns and adds no new visual pattern.

This ticket owns the client's mail-report service.

## Acceptance criteria

- [ ] The Mail tab shows for an admin and is absent for a moderator.
- [ ] The tiles and the per-day table show the values the server returned.
- [ ] Each rate shows Amazon's review limit beside it, and reads as not yet measured when the volume is under the floor.
- [ ] A non-healthy SES status is shown as text, not by color alone.
- [ ] A failed read shows an error state with the reason, like the Usage tab.
- [ ] No request is left running after the panel closes.
- [ ] The tab has a dev-router entry with a healthy sample and an under-review sample.
- [ ] Frames, light and dark, at a realistic desktop width: `.scratch/frames/mail-tab-<state>-<theme>.png` for healthy and under review.

For you: open the Mail tab after a day of real mail and check the numbers against the SES console.
