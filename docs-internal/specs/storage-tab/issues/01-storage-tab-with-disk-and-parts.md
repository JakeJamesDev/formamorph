# 01: Storage tab with disk and parts

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An admin opens the Admin Panel and sees a Storage tab in the site group, before Server. The tab reads the storage report for 30 days. It shows one segmented bar per filesystem with the alert marks, four stat tiles, and a table of every measured part. A moderator does not see the tab.

This ticket owns the pieces that ticket 02 builds on:

- The storage report service, its interface, and the full report types, `r2` and `days` included.
- The decimal byte formatter.
- The segmented bar, as a component that ticket 02 can reuse with a different scale.
- The dev fixture for the tab. It holds a full report, R2 and history included.
- The panel with an injected API, as the Mail tab has.

The spec's Disk, Parts, Structure, Formatting, and Copy sections hold the rules.

## Acceptance criteria

- [x] An admin sees the Storage tab between Policies and Server. A moderator does not, and a moderator sent to it lands on Users. (`AdminPanelDialog.test.tsx`: "carries the storage report between Policies and Server", "lands on Users when pointed at the storage report")
- [x] The dev routes, the surface map, and the Playwright tab list include the new tab, and the dev router parity test passes. (`devRouter.test.ts` green; the surface map reads the dev-route list; `ADMIN_TABS` in `admin-panel-widths.spec.ts`)
- [x] The tiles show used percent with GB, free, days until full, and vacuum in words. A null forecast shows the no-value dash. (`StorageTab.test.tsx` "the tiles")
- [x] Each disk in the report gets one bar. Its segments are that disk's parts by role, largest first, then the remainder. ("gives each of two disks its own bar, tiles and parts")
- [x] The remainder equals used minus that disk's parts and is never below zero. ("never draws a negative remainder")
- [x] A mark shows at each value of the disk's alert levels. No level is hard-coded. (test uses 70/85/95%)
- [x] The legend lists every segment with its size. The bar is hidden from screen readers. ("is hidden from screen readers")
- [x] The parts table has a row for every part name that is not an R2 name: part, size, files, measured. ("has a row for every part and none for R2")
- [x] A null part shows the dash. A part measured more than 3 hours ago has a note in words, and one inside 3 hours has none. (2.9 h and 5.5 h cases)
- [x] Every size is decimal: 1,000,000,000 bytes shows as 1.0 GB. The formatter has unit tests at each unit boundary up to TB. (`usageReport.test.ts` "bytes")
- [x] The tab reads only while active, aborts on close or tab switch, and shows the failure reason with a toast on a failed read. ("reading" block; a failed read keeps the last report under the error line)
- [x] The segmented bar is in the design system doc and its dev-router showcase. (Design-System.md "Pattern: Segmented Bar"; showcase id `segmented-bar`)
- [x] The copy passes the `copy-sweep` skill. (`npm run copy:sweep` on the new files: 0 notices)
- [x] Frames exist for the dev fixture in light and dark at desktop and narrow widths: `.scratch/frames/storage-disk-light-wide.png`, `storage-disk-dark-wide.png`, `storage-disk-light-narrow.png`, `storage-disk-dark-narrow.png`. (Playwright, 1280×900 and 375×812)
- [ ] The changelog has one line for the Storage tab.
- [x] Each guard above was proved by reinstating its bug and watching its test fail. (16 mutations, each failed its test)

For you: the segmented bar is a new visual pattern. Look at the frames, or at the dev route's `fixture=storage`, and approve or change the segment colors, the gap, and the marks.
For you: read the tab's labels and lines. They are written from a facts list, not from the spec.

## Landed

**Not verified**

- The changelog line. The changelog rules give admin tools no entry, and the Usage and Mail tabs have none. The spec session was asked to confirm; no line ships until it rules.

**For you**

- The segmented bar is a new visual pattern. Look at the frames, or at the dev route's `fixture=storage`, and approve or change the segment colors, the gap, and the marks: `.scratch/storage-tab-01/frames/storage-disk-light-wide.png`, `storage-disk-dark-wide.png`, `storage-disk-light-narrow.png`, `storage-disk-dark-narrow.png`. In light, Database (chart-1) and Other Uploads (chart-5) are close in hue.
- Read the tab's labels and lines. They are written from a facts list, not from the spec.
- The four small upload folders (Pending Uploads, Avatars, Event Posters, Supporter Content) share one Other Uploads segment, because there are 5 chart hues for 8 parts. The table lists each.
