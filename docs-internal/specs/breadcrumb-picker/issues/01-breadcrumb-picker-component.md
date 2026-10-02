# 01: Breadcrumb Picker, with Add Requirement on It

Status: ready-for-human
Base: 83502ab3
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

Build the shared **Breadcrumb Picker**: a searchable single-select popover on the Popover and Command parts. Rows come in the order given, each with its name and a right-aligned breadcrumb. Then move **Add Requirement** in a trait's **Requires** field onto it, with no change in behavior (Q12).

- Sections take an optional heading and rows. A row has a unique key, the value it picks, a name, breadcrumb segments and an optional disabled flag. Rows are unique by key, not by value. Every row whose value equals the current value shows a check (Q3).
- Search matches name and full breadcrumb text, case-insensitive substring, without sorting. The search field always shows (Q14).
- Row layout (Q15): the name keeps its natural width up to about 65% of the row, then truncates. The breadcrumb takes the rest, in meta text, and truncates. Three or more segments render as `First › … › Last`. A hover tooltip on the row shows the full path through the shared themed tooltip. A row with no breadcrumb has no tooltip.
- Two trigger modes: a Select-style field trigger (used from ticket 03) and a caller-supplied trigger.
- A caller can replace the list page. Add Requirement's bearer page uses this and keeps its back button and its own search.
- The requirement options builder returns breadcrumb segments instead of a joined `where` string. `World` and `Persona` stay.

## Acceptance criteria

- [ ] A component test covers the collapse for one, two and three-plus segments, the full-path tooltip, the check on every row that holds the current value, the "No matches" and empty lines, keyboard pick, and Escape.
- [ ] The existing Requires field test passes with no change to its current assertions. New assertions cover the collapse on a deep path.
- [ ] Add Requirement looks and behaves as before, apart from the collapse and tooltip on long paths.
- [ ] The four gates are green.
