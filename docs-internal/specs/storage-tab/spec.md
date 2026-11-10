# Spec: Storage Tab

Status: ready-for-agent
Spec session: storage-tab — spec

Client only. The server half is done: see `docs-internal/specs/storage-report/spec.md` in the server repo for the report's shape and rules.

## Problem Statement

The server measures its disk, its upload directories, and its R2 buckets every hour. It mails the admins at 80% and 90% disk use. An admin still cannot look at any of it without an SSH session or the Cloudflare dashboard.

- The Admin Panel shows Formamorph AI usage and mail health. It shows nothing about storage.
- An admin cannot see which part of the disk grows, or how many days are left.
- An admin cannot see whether a database vacuum fits in the free space.
- R2 went over its 10 GB free tier once. Nobody saw it before the invoice.

## Solution

A **Storage** tab in the Admin Panel, for admins only. It reads `GET /api/storage/report?days=N` and shows four sections:

| Section | Content |
|---|---|
| 💽 Disk | A segmented bar per filesystem, with the 80% and 90% marks, and four stat tiles |
| 📁 Parts | A table of every measured part with size, files, and measured time |
| ☁️ R2 | A segmented bar of both buckets against the free tier |
| 📈 History | Column charts of disk used, R2 total, and downloads per day, and a per-day table |

## User Stories

1. As an admin, I want a Storage tab in the Admin Panel, so that I can check the disk without an SSH session.
2. As an admin, I want to see the used percent of the disk at a glance, so that I know whether to act.
3. As an admin, I want one bar that shows what fills the disk, so that I know what to clean up.
4. As an admin, I want the 80% and 90% marks on that bar, so that I see how close the next alert mail is.
5. As an admin, I want to see free space in GB, so that I can compare it with an upload or a backup.
6. As an admin, I want to see the days until the disk is full, so that I can plan an upgrade.
7. As an admin, I want no number when the server has no forecast, so that I am not misled.
8. As an admin, I want to see whether a vacuum fits, so that I do not start one that fails.
9. As an admin, I want the space that no measured part explains to show as its own segment, so that the bar adds up to the used total.
10. As an admin, I want a table of every part with its size and file count, so that I can read exact figures.
11. As an admin, I want to see when each part was last measured, so that I can tell a stale number from a current one.
12. As an admin, I want a note in words on a part that was not measured for hours, so that I see a failed measurement.
13. As an admin, I want a part that was never measured to show no value, so that a missing number does not look like zero.
14. As an admin, I want to see both R2 buckets against the 10 GB free tier, so that I see a cost before the invoice.
15. As an admin, I want to see how far over the free tier R2 is, so that I know the size of the cost.
16. As an admin, I want one line of text when the server has no R2 access, so that I know why the numbers are missing.
17. As an admin, I want disk use per day as a chart, so that I can see the growth rate.
18. As an admin, I want R2 size per day as a chart, so that I can see how fast it grows toward the free tier.
19. As an admin, I want downloads per day as a chart, so that I can relate traffic to growth.
20. As an admin, I want to switch the range between 7, 30, 90, and 365 days, so that I can see both this week and this year.
21. As an admin, I want a day with no measurement to show as empty, so that a gap does not look like a drop.
22. As an admin, I want every size in decimal GB or MB, so that the numbers match Hetzner, Cloudflare, and the alert mail.
23. As an admin with a screen reader, I want the charts' figures in a table, so that I can read the history.
24. As an admin, I want a clear line when the report cannot be read, so that I do not mistake a failure for an empty server.
25. As a moderator, I do not see the Storage tab, so that the strip shows only what I can open.
26. As a server with two filesystems, I want one bar per filesystem, so that each one shows its own fullness.

## Implementation Decisions

Rulings from the grill:

| # | Ruling |
|---|---|
| Q1 | Every size shows in decimal units, 1 GB = 1,000,000,000 bytes. The server alert mail changed to match (server commit e522034). |
| Q2 | The disk section uses a segmented bar. It is the meter and the breakdown together. No pie or donut. |
| Q3 | Downloads per day and R2 total per day each get a chart. There is no per-part growth column. |
| Q4 | Range buttons 7 / 30 / 90 / 365 days. The default is 30. |
| Q5 | The client shows a "system and app" segment: disk used minus the measured parts on that disk. |
| Q6 | The three history charts reuse the Usage tab's day chart. No chart library. |
| Q7 | The tab is named Storage. It is admin only and sits in the site group, before Server. |
| Q8 | A 404 from a server without the route gets the normal error line and toast, as the Mail tab does. |
| Q9 | When the report's `r2` is null, the R2 section stays and shows one line of text. |
| Q10 | Each part and bucket shows its measured time. One older than 3 hours gets a note in words. |
| Q11 | R2 uses the segmented bar: one segment per bucket on the free-tier scale. |
| Q12 | Vacuum is a stat tile, beside Used, Free, and Days Until Full. |
| Q13 | No CSV export. |

### Structure

- **Follow the Mail tab.** A service with one fetch function and an exported interface. A panel component that takes that interface as a prop. A thin tab wrapper that picks the real service or a dev fixture.
- **Fetch.** Only while the tab is active. A new fetch on each range change. An abort on close or tab switch. The last report stays on screen until the next one lands.
- **Tab registry.** The new tab id joins the tab list, the admin-only list, the tab faces, and the site group. The dev routes, the surface map, and the Playwright tab list stay in step with it.
- **Shared blocks.** The section, tile, figures table, and day chart come from the Usage tab. Move the day chart to a shared place if the import needs it.

### Disk section

- One segmented bar per entry in `disks`. The bar's full width is the disk's `total`.
- **Segments.** Each measured part on that disk, largest first, then the "system and app" remainder. Free space is the empty track.
- **Which parts are on which disk.** The disk id lists its roles. Upload directories belong to the storage role, the database to the data role, and local backups to the app role.
- **Remainder.** `used` minus the sum of that disk's parts, never below zero.
- **Marks.** A mark at each value in the disk's `alertLevels`. The client does not hard-code 80 and 90.
- **Tiles.** Used (percent and GB), Free, Days Until Full, Vacuum. A null forecast shows the no-value dash. Vacuum reads in words, not color.
- A legend under the bar lists each segment with its size. The bar itself is hidden from screen readers; the parts table holds the figures.
- The segmented bar is a new visual pattern. It needs the user's approval in the design system showcase before adoption. The mock from the grill was an inline chat widget, not a file. It showed a flat bar, a 2px gap between segments, dashed marks, and a legend grid of swatch, name, and size.
- **Segment colors (ticket 01 ruling).** Each part has its own hue from the chart tokens. The remainder is neutral, and free space is the muted track. A part keeps its hue when the order changes. This is an exception to the Usage Report's one-color bar rule, for a part-to-whole bar only. There are 5 chart tokens and 8 parts, so the mapping is fixed: database, worlds, backups, and thumbnails each have a token. Pending, avatars, event posters, and supporter-private fold into one "other uploads" segment with the fifth token, in the bar and the legend only; the table lists each.
- **Two disks (ticket 01 ruling).** Each disk has its own tile row above its own bar, headed by the disk. Vacuum shows once, with the disk that holds the data role. The parts table stays flat, with no disk column.

### Parts section

- One table: part, size, files, measured. Every name in `parts` has a row, R2 names excluded.
- A null part shows the no-value dash in every figure.
- A measured time older than 3 hours adds a note in words on that row.

### R2 section

- One segmented bar. Its full width is `freeTierBytes`. One segment per bucket.
- Above the free tier, the bar is full and a line states the amount over.
- A line under the bar gives each bucket's size, object count, and checked time. The 3-hour note applies to `checkedAt`.
- A null bucket shows the no-value dash. A null `r2` replaces the bar with one line of text.
- **Ticket 02 rulings.** Bucket hues go by position, never by name: the first bucket in the report has the second chart token, the next has the third. The server lists the files bucket first. One row per bucket under the bar replaces the bar's legend: swatch, name, size, objects, checked time, and the stale note. A null bucket keeps its row and has no segment. While a bucket is null, the R2 total reads "at least", so a missing bucket cannot hide an overage.

### History section

- Three day charts on the same day axis: disk used, R2 total, downloads.
- **Disk used.** The `disk:<id>:used` value per day. The chart's tick line marks the first alert level of the current total. With two disks, the chart has a disk switcher.
- **R2 total.** The sum of the `r2:<bucket>` values per day. A day where any bucket is null is empty.
- **Empty days.** A null value draws no column. It is never drawn as zero.
- A per-day table under the charts holds the same figures: day, disk used, R2 total, downloads.
- **Ticket 02 rulings.** The range buttons sit on the History section's heading. The table has one disk-used column per disk, whatever the chart's switcher shows. Only downloads marks today as "so far"; disk and R2 are snapshots and draw at full strength. Above 60 columns the day chart has no gap between columns. There is no aggregation at 365 days.

### Formatting

- A new byte formatter in the usage report helpers: decimal, largest unit that keeps the value at 1 or more, one decimal place, up to TB. The existing image formatter stops at MB and is for prompt copy, so it stays as it is.
- Measured times use the existing instant label.

### Copy

- All labels and lines follow the Writing Guide and are written from a facts list, not from this spec. The words in this spec are working names.

## Testing Decisions

A good test mounts the panel with a fake report and checks what an admin sees or what the fake was asked. It does not check component state.

One seam: **the storage panel with an injected API**. Prior art: the Mail tab and Usage tab tests. Cases:

- The tiles show used, free, days until full, and vacuum from the report. A null forecast shows the dash.
- The legend lists each part on the disk and a remainder that equals used minus the parts. The remainder is never negative.
- A mark exists for each alert level in the report.
- A two-disk report shows two bars, each with its own parts.
- The parts table shows every name. A null part shows the dash. A part older than 3 hours has the note, and one inside 3 hours does not.
- The R2 section shows both buckets. A report over the free tier states the amount over. A null `r2` shows the line of text and no bar.
- The per-day table shows an empty cell, not zero, for a day with a null value.
- The range buttons request 7, 30, 90, and 365. A slower, older answer is ignored.
- A failed read shows the reason. No read happens while the tab is inactive. A close aborts the read.

Also:

- The byte formatter has unit tests at each unit boundary.
- The Admin Panel dialog test shows the Storage tab for an admin and not for a moderator.
- The dev router parity test covers the new tab id.

Each guard is proved by reinstating its bug and watching the test fail.

## Out of Scope

- A CSV export.
- Per-part growth over the range.
- Per-part history charts.
- A refresh button or automatic refresh.
- A special message for a server without the route.
- Any server change. The report is fixed.

## Further Notes

- No changelog entry (ticket 01 ruling). The changelog rules give staff and admin tools no entry, and the Usage and Mail tabs have none.
- The server work is not deployed yet. Deploy it before a client release that has this tab.
- The first days after the deploy have little history. The charts and the forecast fill in over a week.
- The server counts `usedFraction` against the full disk. Root-reserved blocks on the server are not verified, so the tab's free space can differ a little from what a non-root process can write.
