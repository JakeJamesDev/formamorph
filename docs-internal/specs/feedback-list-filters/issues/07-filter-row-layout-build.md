# 07: Filter Row Layout Build

Status: done
Base: e35ca129
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** this repo only.

**What to build:** The filter row from the layout the user picked in ticket 06, in both tabs. Staff see search, Status, and Sort; Category is hidden (Q7). Users see search, the scope, and the file button; Status, Category, and Sort are hidden (Q8). The hidden-filters control shows a badge with the number of hidden filters that differ from their defaults. Reset returns every filter to its default, the visible ones included (Q11).

The new pattern joins the design system and its showcase, since the user approved it in ticket 06.

- [x] The row matches the picked layout for staff and users
- [x] The badge counts only hidden filters that differ from defaults; no badge at defaults
- [x] Reset restores every default and page 1
- [x] The row fits a narrow window without wrapping controls out of reach
- [x] Design system doc and showcase updated
- [x] Tests at the tab seam for the badge count and Reset
- [x] Verified on the dev route in both themes
- [x] Changelog line under In Progress

## Outcome

- **Code:** `StaffFilterRow` and `UserFilterRow` in `src/components/menu/FeedbackFilterRow.tsx`; state, badge count, and Reset in `useFeedbackFilters`; defaults and hidden lists in `feedbackPresentation.ts`.
- **Tests:** `feedbackFilterRow.test.tsx` at the tab seam. Six mutants (badge counts every filter, badge at zero, Reset keeps the page, clears search, resets only hidden filters, enables only for hidden changes) each fail it.
- **Reference:** `#dev?modal=designSystem&tab=filter-row`; guide section "Filter Row With Filters Popover".
- **Frames (untracked):** `.scratch/filter-row-07/`: desktop light defaults and badge, desktop dark staff popover, mobile dark defaults and badge.
- **Open for the user:** at 375px the staff Sort trigger shows "Most…" for Most Voted, as in the prototype's two-column narrow layout.
