# 03: Searchable Name Levels

Status: ready-for-human
Blocked by: 02 — Drill Menu in the Stat Box
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), decision 2, rulings Q5, Q15.

## What to build

A name level in the drill menu renders the existing breadcrumb picker list: a search box, one row per name with its folder or group trail, and the picker's empty message when a search misses. The search box takes focus when the level opens, so typing filters at once. Backspace or Left in a non-empty search box edits the text; in an empty one, it goes back a level. Enter on the active row drills into it. The Back row stays above the list. Group and field levels are unchanged.

Note from ticket 02: the menu's key handler prevents Backspace and Left with no target check. Narrow it so a non-empty search box keeps both keys. Each level opens on its Back row; keep that, and move focus into the search box after it.

Workload: cmdk's own key handling must share the Popover with the drill's keyboard; the empty-search Backspace rule is the trap. A top model at high effort.

## Acceptance criteria

- [ ] Stats, Traits, Entities, Placeholders, Dictionaries, and an entity's or the persona's Traits and Placeholders show a search box and rows with trails
- [ ] Typing filters by name and by trail; a miss shows the picker's empty message
- [ ] The search box has focus when a name level opens
- [ ] Backspace with text edits the search; Backspace or Left with an empty search goes back
- [ ] Enter on a row drills into that name; Escape still closes the menu
- [ ] Both themes checked at a realistic viewport; the list matches the template slot picker
- [ ] Changelog: fold into ticket 02's entry
