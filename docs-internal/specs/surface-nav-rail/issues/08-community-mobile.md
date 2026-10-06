# 08: Community Mobile Header And Sections Bar

Status: ready-for-human
Blocked by: 06, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Recommended model rationale: mobile header rearrangement in one view, reusing the Sections bar ticket 06 settled; moderate.

## What to build

On mobile Community Creations' header first row reads back, search, Filters (Q28). Filters is an icon button with its turning chevron and a count badge while filters are on. Refresh moves into the Filters panel: its first row is the sort select filling the row, then the order toggle and refresh at the right edge.

The Sections bar under the header replaces the section dropdown, grouped like the rail (Q29). Changelog fragment: its own lead on Community's mobile header and Sections bar (Q37).

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245. Mobile settled in commits `9ef4923c` and `40d2329c`.

## Acceptance criteria

- [ ] Mobile header row holds back, search and the Filters button, and fits at 360px.
- [ ] The Filters chevron turns when the panel opens; the badge shows the active filter count.
- [ ] The panel's first row holds the sort select filling the row, then the order toggle and refresh at its right edge.
- [ ] The Sections bar replaces the dropdown, with the rail's order and lines.
- [ ] Existing Community tests that used the dropdown or the labeled Filters button are retargeted.
- [ ] Changelog fragment written.
- [ ] Gates green.

## Blocked by

- 06, 07
