# 02: Plain Surface Sweep

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: eleven mechanical migrations onto a finished component, each with a small host-level test; the only judgment is per-host side state, which the spec lists.

## What to build

Every plain search, find, and filter box moves onto `SearchField`: the editor list toolbar (which covers every World Editor list), Memory Manager, Add From Library, the game Traits tab filter, Find a Group, the drill picker filter, the Guide search, the Library additions search, the Community browser search, Find a Location, Manage Users, and the Audit Log search.

Boxes with no icon today gain one (Q5). Hosts with side state pass their own `onClear`: Community clears the typed text through its existing apply path and keeps its filter chips; Find a Location resets the active row; the drill picker drops its blocked note; the list toolbar calls its search model's clear. Manage Users and Audit Log run the empty search at once on clear (Q4). The Guide search keeps swallowing Escape (Q8).

Changelog: none; 01's lead covers it (Q13).

## Acceptance criteria

- [ ] All twelve boxes render through `SearchField` with the icon and the X.
- [ ] Community: clearing removes the typed text and keeps existing chips.
- [ ] Find a Location: clearing resets the highlighted row.
- [ ] Drill picker: clearing drops the blocked note.
- [ ] Manage Users and Audit Log: clearing shows the unfiltered list without a submit.
- [ ] Guide search: Escape still does not clear.
- [ ] Each host has one test that the X clears its own state; no existing assertion is weakened.
- [ ] Four gates green.
