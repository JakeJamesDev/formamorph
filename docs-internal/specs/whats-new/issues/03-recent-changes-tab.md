# 03: Recent Changes Tab

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Recent Changes tab shows the one-line-per-entry list for the installed version and the two releases before it, read from the changelog bundled in the build. It works offline and no longer reads GitHub release bodies. The spec covers this in Q6 and Q9, and in the "Recent Changes" decision.

- **Build-time slice.** At build time, take the changelog sections for the installed version and the two releases before it, which may cross a minor-series boundary. Keep only the bold leads of the 👤 entries, grouped by Added, Removed and Fixed, using the same rules as the release-note extraction. This slice is separate from the Formaquestion docs-index slice, which stays unchanged.
- **Tab.** Render the slice in the Recent Changes tab with today's changelog typography: version headings, with the installed version tinted. Full changelog stays bottom-left.

## Acceptance criteria

- [ ] Recent Changes shows three versions' bold leads with the network unavailable.
- [ ] A slice test covers a window that crosses a minor-series boundary, and one where fewer than three releases exist.
- [ ] Dev and 🛠️/⚙️ entries never appear in the tab.
- [ ] The Formaquestion docs index content is unchanged (its existing tests stay green without edits).
- [ ] Frame `.scratch/frames/recent-changes-dark.png`: the tab at 1440×900, dark theme.
