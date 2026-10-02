# 07: Filter Row Layout Build

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** this repo only.

**What to build:** The filter row from the layout the user picked in ticket 06, in both tabs. Staff see search, Status, and Sort; Category is hidden (Q7). Users see search, the scope, and the file button; Status, Category, and Sort are hidden (Q8). The hidden-filters control shows a badge with the number of hidden filters that differ from their defaults. Reset returns every filter to its default, the visible ones included (Q11).

The new pattern joins the design system and its showcase, since the user approved it in ticket 06.

- [ ] The row matches the picked layout for staff and users
- [ ] The badge counts only hidden filters that differ from defaults; no badge at defaults
- [ ] Reset restores every default and page 1
- [ ] The row fits a narrow window without wrapping controls out of reach
- [ ] Design system doc and showcase updated
- [ ] Tests at the tab seam for the badge count and Reset
- [ ] Verified on the dev route in both themes
- [ ] Changelog line under In Progress
