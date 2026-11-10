# 02: R2 and history

Status: ready-for-agent
Blocked by: 01 — Storage tab with disk and parts
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The Storage tab gains its R2 section and its history section. An admin sees both buckets on one bar against the free tier. An admin switches the range between 7, 30, 90, and 365 days and sees disk used, R2 total, and downloads per day as column charts, with the same figures in a table.

This ticket reuses ticket 01's segmented bar, byte formatter, report types, and dev fixture. It reuses the Usage tab's day chart; move the chart to a shared place if the import needs it, with no change in the Usage tab's behavior.

The spec's R2, History, and Copy sections hold the rules.

## Acceptance criteria

- [ ] The R2 bar's full width is the report's free tier, with one segment per bucket.
- [ ] A line gives each bucket's size, object count, and checked time. A null bucket shows the dash. A bucket checked more than 3 hours ago has the note.
- [ ] A report above the free tier shows a full bar and states the amount over in decimal units.
- [ ] A null `r2` shows one line of text and no bar. The R2 history chart shows no columns then.
- [ ] The range buttons are 7, 30, 90, and 365 days, with 30 selected at first. Each one requests the report with that value.
- [ ] A slower, older answer is ignored when a newer range was requested.
- [ ] The disk chart shows the used value per day, with a tick line at the first alert level of the current total.
- [ ] A report with two disks gives the disk chart a disk switcher.
- [ ] The R2 chart shows the sum of both buckets per day. A day where one bucket is null is empty.
- [ ] The downloads chart shows downloads per day.
- [ ] A day with a null value draws no column and shows an empty cell in the table, never zero.
- [ ] The per-day table lists day, disk used, R2 total, and downloads for the whole range.
- [ ] The Usage tab's tests pass unchanged after any move of the day chart.
- [ ] The copy passes the `copy-sweep` skill.
- [ ] Frames exist for the dev fixture: `.scratch/frames/storage-history-light-wide.png`, `storage-history-dark-wide.png`, `storage-history-light-narrow.png`.
- [ ] The changelog line from ticket 01 covers R2 and history. It stays one entry.
- [ ] Each guard above was proved by reinstating its bug and watching its test fail.

For you: look at the 365-day range in the dev fixture. Check that 365 columns stay readable at the narrow width.
For you: after the server deploy, open the tab against production and compare the R2 total with the Cloudflare dashboard.
