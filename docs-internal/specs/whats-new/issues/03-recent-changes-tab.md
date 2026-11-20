# 03: Recent Changes Tab

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Recent Changes tab shows the one-line-per-entry list for the installed version and the two releases before it, read from the changelog bundled in the build. It works offline and no longer reads GitHub release bodies. The spec covers this in Q6 and Q9, and in the "Recent Changes" decision.

- **Build-time slice.** At build time, take the changelog sections for the installed version and the two releases before it, which may cross a minor-series boundary. Keep only the bold leads of the 👤 entries, grouped by Added, Removed and Fixed, using the same rules as the release-note extraction. This slice is separate from the Formaquestion docs-index slice, which stays unchanged.
- **Tab.** Render the slice in the Recent Changes tab with today's changelog typography: version headings, with the installed version tinted. Full changelog stays bottom-left.

## Acceptance criteria

- [x] Recent Changes shows three versions' bold leads with the network unavailable. (`WhatsNewHost.test.tsx`: "shows the bundled notes with the network unavailable"; the slice test on the real changelog lists v3.7.0, v3.6.2, v3.6.1.)
- [x] A slice test covers a window that crosses a minor-series boundary, and one where fewer than three releases exist. (`recentChangesSlice.test.mjs`: the minor-series and fewer-than-three cases.)
- [x] Dev and 🛠️/⚙️ entries never appear in the tab. (`recentChangesSlice.test.mjs`: "never shows developer or backend entries".)
- [x] The Formaquestion docs index content is unchanged (its existing tests stay green without edits). (`changelogSlice.ts` and its test are not in the diff.)
- [x] Frame `.scratch/frames/recent-changes-dark.png`: the tab at 1440×900, dark theme. (Captured at 1440×900, stored at 800×500.)

## Landed

**Not verified**

- The frame is stored at 800×500, scaled down from the 1440×900 viewport by the Browser pane.

**For you**

- Recent Changes, `#dev?view=mainMenu&modal=whatsNew&tab=web`: a release with no 👤 entries shows the extractor's maintenance line as a plain bullet, not a muted line.
- Recent Changes lists each feature group with every nested entry, as the extractor does, so the 3.7.0 section is long. Judge whether that reads as one line per entry.
