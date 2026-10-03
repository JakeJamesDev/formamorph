# 06: Filter Row Layout Prototype

Status: done
Base: 8dd31366
Blocked by: 03, 04, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** a prototype worktree (`/prototype`).

**What to build:** Two or three layouts of the feedback filter row for the user to pick one from (Q6). Each shows both viewers:

- Staff always see search, Status, and Sort (Q7). Category is hidden.
- Users always see search, the scope, and the file button (Q8). Status, Category, and Sort are hidden.
- The hidden-filters control shows a badge with the number of hidden filters that differ from their defaults, and offers Reset (Q11).

Use production components and the design system's patterns. Show each layout on the dev route in both themes at a realistic dialog width, including a narrow window.

- [x] 2–3 layouts, each with the staff and user variants
- [x] Each layout shows the badge and Reset states
- [x] Static frames in both themes at a realistic width and a narrow width
- [x] The user picks one; the pick and any changes are recorded in the spec
- [x] Status set to `ready-for-human` with the frames linked

## Outcome

**Question:** Which filter-row layout does ticket 07 build?

**Verdict (user, 2026-10-02):** Layout A, "One Row, Filters Popover". The spec records it as ruling Q18.

| Variant | Shape |
|---|---|
| **A (picked)** | One row: search, the visible controls, and a Filters button with a count badge. The button opens a popover with the hidden filters and Reset. |
| B | The same row with a More toggle. The toggle opens a tinted second row with Reset and the hidden filters. |
| C | Search on top with an icon filter button. Pill selects or a segmented scope below, plus removable chips for changed hidden filters. |

Layout A details for ticket 07:

- **Row:** search grows, then the visible controls, then **Filters** (`ListFilter` icon and a `Badge` count). The user row ends with the file button.
- **Popover:** `PopoverContent` with `portal={false}`, `align="end"`, `collisionPadding={12}`. The hidden filters are labeled selects. A divider, then a ghost **Reset Filters** button (`RotateCcw`) at the left. Reset is disabled when every filter is at its default.
- **Narrow (below `sm`):** search takes its own row. Staff Status and Sort sit in two equal grid columns. Filters is icon-only with the badge in the top-right corner. The file button is icon-only, with its label kept for screen readers.
- **Accessible name:** "More Filters", or "More Filters, N changed" when the badge shows.
- **Reset:** restores Status, Category, Sort, and scope, returns to page 1, and keeps the search text (spec session ruling).

**Prototype:** branch `prototype/filter-row-layout`, commit `41b8a13a`, file `src/components/menu/FeedbackFilterRow.prototype.tsx`. The worktree stays at `.claude/worktrees/prototype-filter-row-layout` until review ends.

- **Run:** `preview_start` the `prototype-filter-row-layout` launch entry (port 5232), then open `#dev?modal=filterRowPrototype&variant=A`. Query keys: `viewer=staff|user`, `preset=defaults|changed`, `tab=bug|suggestion`, `panel=open`.
- **Frames (untracked):** `.scratch/feedback-filter-row-frames/sheet-A.png`, `sheet-B.png`, `sheet-C.png`, plus 36 single frames named `<variant>-<viewer>-<width>-<theme>-<state>.png`.
