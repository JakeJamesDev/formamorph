# 02: R2 and history

Status: ready-for-human
Blocked by: 01 — Storage tab with disk and parts
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The Storage tab gains its R2 section and its history section. An admin sees both buckets on one bar against the free tier. An admin switches the range between 7, 30, 90, and 365 days and sees disk used, R2 total, and downloads per day as column charts, with the same figures in a table.

This ticket reuses ticket 01's segmented bar, byte formatter, report types, and dev fixture. It reuses the Usage tab's day chart; move the chart to a shared place if the import needs it, with no change in the Usage tab's behavior.

The spec's R2, History, and Copy sections hold the rules.

## Acceptance criteria

- [x] The R2 bar's full width is the report's free tier, with one segment per bucket. (`scales the bar to the free tier, one segment per bucket in the report order`; hues by report order, ruling 1: `colors buckets by their place in the report, not by name`)
- [x] A line gives each bucket's size, object count, and checked time. A null bucket shows the dash. A bucket checked more than 3 hours ago has the note. (A table row per bucket, ruling 2: `gives each bucket its size, objects and checked time…`, `shows the dash for a bucket never checked…`)
- [x] A report above the free tier shows a full bar and states the amount over in decimal units. (`fills the bar and states the amount over the free tier`; with a never-checked bucket the line says "at least": `gives the total as a floor…`)
- [x] A null `r2` shows one line of text and no bar. The R2 history chart shows no columns then. (`shows one line and no bar…`, `draws no R2 columns when the server has no R2 access`)
- [x] The range buttons are 7, 30, 90, and 365 days, with 30 selected at first. Each one requests the report with that value. (`reads 30 days first and each range when picked`)
- [x] A slower, older answer is ignored when a newer range was requested. (`ignores a slower answer for a range the reader has left`)
- [x] The disk chart shows the used value per day, with a tick line at the first alert level of the current total. (`draws disk used per day, no column for a day with no value, and a tick at the first alert level`)
- [x] A report with two disks gives the disk chart a disk switcher. (`switches the disk chart between two disks`, `has no disk switcher with one disk`)
- [x] The R2 chart shows the sum of both buckets per day. A day where one bucket is null is empty. (`draws the sum of both buckets per day…`)
- [x] The downloads chart shows downloads per day. (`draws downloads per day, with only today faint`; ruling 4)
- [x] A day with a null value draws no column and shows an empty cell in the table, never zero. (The cell shows the app's no-value dash: `lists every day in a table, with the dash for a missing value and never zero`)
- [x] The per-day table lists day, disk used, R2 total, and downloads for the whole range. (Same test; one column per disk, ruling 3: `gives each of two disks its own column in the table`)
- [x] The Usage tab's tests pass unchanged after any move of the day chart. (`DayChart` is exported from `UsageTab.tsx`, not moved; `UsageTab.test.tsx` untouched, 25/25 green)
- [x] The copy passes the `copy-sweep` skill. (`npm run copy:sweep` on `StorageTab.tsx`: one period-shape notice, fixed; template-string status lines checked by hand)
- [x] Frames exist for the dev fixture: `.scratch/frames/storage-history-light-wide.png`, `storage-history-dark-wide.png`, `storage-history-light-narrow.png`. (Playwright at 1280 and 375 wide, tall viewports so the whole section fits; plus `storage-history-light-narrow-365.png`, `storage-r2-*.png`)
- [x] Each guard above was proved by reinstating its bug and watching its test fail. (17 mutations, each failed its named test; restores verified)

For you: look at the 365-day range in the dev fixture. Check that 365 columns stay readable at the narrow width.
For you: after the server deploy, open the tab against production and compare the R2 total with the Cloudflare dashboard.

## Landed

**Not verified**

- Nothing left unticked.

**For you**

- Look at the 365-day range in the dev fixture. Check that 365 columns stay readable at the narrow width. At 375 px each column is 0.72 px wide. Disk Used and R2 Total read as a filled area with thin stripes at the missing days. Downloads shows a moiré pattern from the varying heights: `.scratch/storage-tab-02/frames/storage-history-light-narrow-365.png`.
- After the server deploy, open the tab against production and compare the R2 total with the Cloudflare dashboard.
- Approve or change two new treatments in the design system: the R2 bar draws no legend, and its bucket table's first cell carries the swatch; day-chart columns touch above 60 days. Frames: `.scratch/storage-tab-02/frames/storage-r2-light-wide.png`, `storage-r2-dark-wide.png`, `storage-history-light-wide.png`, `storage-history-dark-wide.png`, `storage-history-light-narrow.png`.
- Below 640 px, the range buttons sit as the first row under the History heading, because four labels do not fit beside it (`storage-history-light-narrow.png`).
