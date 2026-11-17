# 02: Collapsible Nav

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Enter World category nav becomes collapsible, and it collapses itself level by level until it fits without scrolling. The spec covers this in Q3–Q6, Q8–Q11, Q13 and Q15–Q17. It builds on ticket 01's nav model.

- **Variant A rows (Q17):** every row gets a fixed-width leading slot. A parent row has a chevron there, and a leaf row leaves it empty. Rows indent 12 px per depth level, capped as today. The chevron has `aria-expanded` and an "Expand <name>" or "Collapse <name>" label.
- **Separate targets (Q8):** the row navigates and the chevron toggles. Opening a collapsed parent does not expand it.
- **The fit:** a pure function in the trait workspace module. It takes every row's measured height with the nav fully expanded, the space available, the parent depths and the protected ids (the current page's ancestors). It returns the cut depth. It collapses every parent at the deepest remaining level together (Q9), then checks the fit again. It never collapses a protected id (Q5), and it stops after the top level (Q16).
- **Available height:** the nav's own height on desktop, and 45% of the window height in the mobile drawer (Q10).
- **State (Q4, Q6):** "auto" recomputes the fit when the screen opens and on every window resize. "Manual" begins at the first chevron or Collapse All / Expand All click and keeps the player's set from then on. A manual collapse of the current page's ancestor stands (Q15). State lasts for one setup and resets on the next Enter World.
- **Collapse All / Expand All (Q11, Q13):** one icon button at the right end of the Starting Traits separator, shown only when a row has children. While any parent is expanded it reads Collapse All, and that folds the nav to the top-level rows. Otherwise it reads Expand All, which opens every level.
- Main-panel sections never collapse (Q3).

Prior art: prototype `prototype/setup-nav-fallthrough` (`07da61d2e`), Variant A. Its fit re-renders and reads the scroll height at each step. The spec replaces that with one measurement and a pure computation.

## Acceptance criteria

- [ ] Parent rows show a leading chevron, and leaf rows keep an empty slot of the same width, so the names align.
- [ ] Clicking a chevron collapses or expands the row without navigating. Clicking a collapsed row opens its page and leaves it collapsed.
- [ ] Unit tests on the fit function cover: everything fits (no collapse); one level is enough; the loop climbs to the top level and stops; protected ancestors stay open; rows of mixed height.
- [ ] With the current page inside a subtree, auto-collapse leaves that page's ancestors expanded.
- [ ] After any manual toggle, a window resize no longer changes the nav. Before any toggle, a resize recomputes the fit.
- [ ] Collapse All folds to the top-level rows and switches to Expand All. Expand All opens every level.
- [ ] Collapse state survives switching pages, and it is fresh the next time Enter World opens.
- [ ] Component tests cover chevron toggling, row-versus-chevron clicks, Collapse All / Expand All, and state across page switches. Each guard is shown to bite.
- [ ] New strings (Collapse All, Expand All, the chevron labels) pass the Writing Guide's "Before you write" check.
- [ ] Frames at 1440×900 in dark and light: `.scratch/frames/nav-auto-collapsed-dark.png` and `.scratch/frames/nav-auto-collapsed-light.png` (a large cast collapsed to fit), plus `.scratch/frames/nav-mobile-drawer.png` at 390×844 with the drawer open.
- [ ] Changelog fragment folds into ticket 01's entry if 01 is unreleased; otherwise it adds its own line under 👤 Added.

For you: resize the window on a large-cast world before and after touching a chevron, and judge whether the nav behaves as you expect.

## Comments
