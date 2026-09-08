# 05: Deliver the accepted phone portrait navigation

Status: ready-for-human
Blocked by: 02
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md); [accepted prototype record](../prototype.md). Visual primary source: `prototype/enter-world` at `16d6c0b9`.

## What to build

Phone players browse the same hierarchy through an inline Categories disclosure, then use the available width for selections. Navigation and content remain visually distinct, while the start action and keyboard/touch interactions remain usable on short, narrow portrait screens.

Model rationale: responsive layout and focus/motion behavior need real-browser iteration; the accepted interaction is well specified and does not require new domain architecture.

## Acceptance criteria

- [x] At phone portrait widths, Categories displays the current category and one disclosure chevron. Expand the permanently open hierarchy directly below the bar; selecting a category collapses this navigation and shows that category's choices.
- [x] Use a shared subtly contrasting background for the bar/list and a stronger bottom border. No shadow, dropdown popup, bottom drawer, branch chevrons, or branch collapsing.
- [x] Bound navigation scrolling so content remains available below it. Expansion/collapse animates normal layout for 150 ms and respects reduced motion. Do not independently animate the selected choices.
- [x] Collapsed categories are unavailable to keyboard focus and accessibility navigation. Focus remains usable after selection-triggered collapse; Categories exposes its expanded state and controls relationship.
- [x] Preserve all hierarchy semantics from 02: arbitrary depth, readable names, direct ratios, plain container labels, no empty General/branches, and single-activation radio/checkbox behavior.
- [x] Keep compact header controls, accessible Introduction action, safe-area spacing, and a stable primary action outside scrolling content. Long descriptions and library artwork do not cause horizontal overflow or hide the finish action.
- [x] Desktop retains its single navigation column and wide content layout. Both themes use app tokens. No special phone-landscape design or tablet optimization is added.
- [x] Work against the workspace's content slots and actual available entry flow. The phone shell must support Library Additions from 03 without coupling itself to library data/finalization internals.

## Verification

- Exercise normal entry at 360 px and 390 px portrait widths, with long text and a five-level hierarchy. Check open/close, selecting categories, scrolling, counts, radios, Introduction, cancellation, and the reachable finish action.
- Inspect both themes, reduced motion, keyboard focus, and touch-sized controls. Verify collapsed controls cannot be reached and that category changes retain the draft.
- When 03/04 are already present, include artwork, ordering, search, and save-defaults controls in these checks; otherwise verify the shared slot with current production content and leave library-specific verification to those tickets.
- Use browser checks for geometry and animation, existing MainMenu/entry tests for behavior. Run relevant gates and report test wall time; no brittle tests of CSS implementation details.

## Scope boundary

This can proceed alongside 03 after 02. Coordinate shared workspace edits rather than introducing a false dependency on library persistence. No Avatar editor, Quick Start, landscape, or tablet redesign.

## Comments

Implemented September 8, 2026. Phone entry uses an inline Categories disclosure with the accepted shared surface, full authored hierarchy, 45dvh scrolling bound, 150 ms layout transition, reduced-motion override, inert collapsed state, and focus return after category selection. Phone category rows are 44px touch targets; desktop keeps the direct navigation column.

- **Gates:** typecheck exit 0 (12.38s), lint exit 0 (about 42s while the generated coverage tree was present; the report was recycled afterward), 8,573 tests passed / 3 skipped, exit 0 (Vitest 53.47s), build exit 0 (14.88s).
- **Focused checks:** 11 workspace tests passed with 96.22% statement/line and 86.66% branch/function coverage. Two Playwright cases passed at 360×800 and 390×800 (18.55s final wall time) with long wrapping content, five hierarchy levels, direct ratios, radio selection and draft retention, bounded navigation, reduced motion, Library Additions, stable finish action, and no horizontal overflow.
- **Regression proof:** removing reduced-motion support failed the browser guard (15.03s); removing focus restoration failed the component guard (2.80s); removing the collapsed `inert` state failed the component guard (2.67s); restoring 32px phone rows failed both browser geometry guards (20.85s). Original source was restored after each mutation.
- **UI:** static live-app checks covered collapsed, expanded, and Library Additions states at 390×844 dark Graphite/System and 360×800 light, plus the unchanged desktop column at 1280×860 light. The finish action remained visible and display settings and viewport overrides were restored.
- **Review:** independent standards and spec reviews found undersized phone rows, a Title Case accessible-name mismatch, and two test-quality improvements. All were fixed; both re-reviews report no outstanding findings or scope creep. Exported world/save shapes, defaults, dev routes, and the package version are untouched.
