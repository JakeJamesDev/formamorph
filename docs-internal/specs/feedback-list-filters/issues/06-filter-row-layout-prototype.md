# 06: Filter Row Layout Prototype

Status: ready-for-agent
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

- [ ] 2–3 layouts, each with the staff and user variants
- [ ] Each layout shows the badge and Reset states
- [ ] Static frames in both themes at a realistic width and a narrow width
- [ ] The user picks one; the pick and any changes are recorded in the spec
- [ ] Status set to `ready-for-human` with the frames linked
