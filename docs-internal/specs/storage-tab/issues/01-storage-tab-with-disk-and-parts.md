# 01: Storage tab with disk and parts

Status: ready-for-agent
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

- [ ] An admin sees the Storage tab between Policies and Server. A moderator does not, and a moderator sent to it lands on Users.
- [ ] The dev routes, the surface map, and the Playwright tab list include the new tab, and the dev router parity test passes.
- [ ] The tiles show used percent with GB, free, days until full, and vacuum in words. A null forecast shows the no-value dash.
- [ ] Each disk in the report gets one bar. Its segments are that disk's parts by role, largest first, then the remainder.
- [ ] The remainder equals used minus that disk's parts and is never below zero.
- [ ] A mark shows at each value of the disk's alert levels. No level is hard-coded.
- [ ] The legend lists every segment with its size. The bar is hidden from screen readers.
- [ ] The parts table has a row for every part name that is not an R2 name: part, size, files, measured.
- [ ] A null part shows the dash. A part measured more than 3 hours ago has a note in words, and one inside 3 hours has none.
- [ ] Every size is decimal: 1,000,000,000 bytes shows as 1.0 GB. The formatter has unit tests at each unit boundary up to TB.
- [ ] The tab reads only while active, aborts on close or tab switch, and shows the failure reason with a toast on a failed read.
- [ ] The segmented bar is in the design system doc and its dev-router showcase.
- [ ] The copy passes the `copy-sweep` skill.
- [ ] Frames exist for the dev fixture in light and dark at desktop and narrow widths: `.scratch/frames/storage-disk-light-wide.png`, `storage-disk-dark-wide.png`, `storage-disk-light-narrow.png`, `storage-disk-dark-narrow.png`.
- [ ] The changelog has one line for the Storage tab.
- [ ] Each guard above was proved by reinstating its bug and watching its test fail.

For you: the segmented bar is a new visual pattern. Look at the frames, or at the dev route's `fixture=storage`, and approve or change the segment colors, the gap, and the marks.
For you: read the tab's labels and lines. They are written from a facts list, not from the spec.
