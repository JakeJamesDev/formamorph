# Shared Editor Drag Context

Status: ready-for-agent

## Problem Statement

Every drag-and-drop list in Formamorph wires its own drag context by hand. Twelve production wirings exist, and each one re-types the same invariants: pointer/keyboard sensors, contained auto-scroll, stable sortable id arrays, drag-time hover suppression, and the Translate-not-Transform row style. The invariants drift. Three times now a fix had to be hand-carried across every surface: the Translate-vs-Transform scale bug (2026-07), the scroll-clamp and auto-scroll runaway rules (2026-07), and this week the unstable-items snap plus hover-under-drag. Two of this week's fixes landed only in the dictionary tree, so authors see smooth, hover-quiet drags there and snapping, hover-lit drags everywhere else.

## Solution

One shared drag layer encodes the invariants once, and every sortable surface renders through it. Dragging then behaves identically across the app: displaced rows slide aside in both directions, nothing under the cursor lights up or pops a tooltip, auto-scroll stays inside the list's own scroll viewport, and drops land exactly as they do today. A surface that needs different semantics (a depth-nesting tree, a packed grid, cross-book zones) passes its own strategy and modifiers through the shared layer instead of rebuilding the layer.

## User Stories

1. As a world author, I want dragging a stat, trait, entity, or location row to slide its neighbors aside smoothly, so that I can see where the row will land before I drop it.
2. As a world author, I want rows under my drag to stay unlit, so that the list does not flicker hover highlights while I reorder.
3. As a world author, I want no tooltips popping open mid-drag, so that my view of the drop position stays clear.
4. As a world author, I want dragging a trait sideways to keep changing its nesting depth, so that the tree's re-parenting gesture survives the shared layer.
5. As a world author, I want dragging in the Locations tree to keep both reorder and re-parent gestures, so that containment editing is unchanged.
6. As a world author, I want dictionary entry and book drags to keep their cross-book and cross-zone moves, so that nothing the dictionary tree can do today is lost.
7. As a world author, I want the placeholders list to drag with the same feel as every other editor list, so that the editor feels like one product.
8. As a world author, I want reordering dictionaries in the Enter World selection modal to feel like the editor lists, so that the same gesture works everywhere.
9. As a world author, I want keyword chips to keep their drag-reorder, so that alias priority editing is unchanged.
10. As a world author, I want image tag thumbnails to keep their drag-reorder, so that scene-image priority editing is unchanged.
11. As a player, I want save rows and save folders to drag with smooth displacement, so that organizing saves feels polished.
12. As a player, I want library tiles to keep their packed-grid drag with groups and resizing, so that library organization is unchanged.
13. As a player, I want the installed-models list to drag smoothly, so that model ordering feels consistent with the rest of the app.
14. As a player on a large imported dictionary, I want entry drags inside the virtualized list to keep working, so that big books stay fully editable.
15. As a keyboard user, I want keyboard-driven sorting to keep working on every migrated surface, so that reordering stays accessible.
16. As a player, I want auto-scroll during a drag to stay inside the list's own scroll area, so that the page never runs away beneath me.
17. As a player, I want drops to land exactly where they land today, so that the refactor changes feel, never outcomes.
18. As a developer, I want the drag invariants encoded in one module, so that the next fix lands everywhere at once instead of being hand-carried.
19. As a developer, I want a new sortable surface to get the invariants for free by rendering through the shared layer, so that future lists cannot reintroduce the drift.
20. As a developer, I want the shared layer to accept per-surface collision, strategy, modifiers, and auto-scroll overrides, so that unusual surfaces do not fork the layer.
21. As a developer, I want a reusable e2e drag-sampling helper, so that any drag regression is provable in a real browser instead of hand-tested.
22. As a developer, I want an ADR recording the drag-layer invariants and their reasons, so that the constraints (free-X trees, Translate-only rows) survive team and agent turnover.

## Implementation Decisions

- A new shared component owns the drag context for every sortable surface. Working name: `EditorDndContext`. It supplies the house defaults: pointer sensor with the 5px activation distance, keyboard sensor with sortable coordinates, contained auto-scroll (never the page, body, or document element), and `closestCenter` collision.
- Everything a surface legitimately varies is a prop passed through to the underlying dnd-kit context: collision detection (dictionary zones use `closestCorners`), modifiers (vertical lists pass the vertical + scroll-ancestor clamps; depth-nesting trees pass their Y-only clamp and keep X free — the long-standing TraitTree rule), auto-scroll overrides (chips and image tags keep it off), measuring strategy, and all drag lifecycle callbacks.
- Drag-time hover suppression lives in the shared component: while a drag is active it stamps a data attribute on its wrapper element, and one global CSS rule turns off pointer events beneath it. No per-surface `pointer-events` classes. Drops are unaffected because dnd-kit collision is rect-based.
- A companion items wrapper (working name: `StableSortableContext`) wraps dnd-kit's sortable context and memoizes the id array internally, keyed on the caller's item array. Callers stop building inline `.map()` id arrays entirely; reference stability becomes unforgeable at the call site. This decision exists because `useSortable` compares items by reference, and a fresh array on a mid-drag render silently replaces the 200ms sort transition with a 0ms one.
- A drag-active signal is readable via a hook from the shared context, for surfaces that change behavior mid-drag (the dictionary tree collapses books during a book drag; the virtualized entry list pins the dragged row's index). Those behaviors stay local to their surfaces; only the signal is shared.
- Row rendering is untouched. The Translate-not-Transform rule stays where it lives today, in the shared sortable row components; the drag layer never styles rows.
- Drop semantics do not change. Every surface keeps its own drag-end handler and reorder logic; the migration replaces wiring, not behavior. Zero visual or interaction diffs are expected outside the two fixed defects (snap displacement, hover under drag).
- All twelve production wirings migrate in this effort, including the micro-contexts (keyword chips, image tags, token autocomplete, the dictionary selection modal), so no straggler recreates the drift.
- A new ADR records the drag-layer invariants: why items must be reference-stable, why trees cannot take bounding clamps on X, why hover goes dark during drags, and why rows use Translate.

## Testing Decisions

- A good test here asserts external behavior only: displaced rows pass through intermediate positions (a slide, not a snap), zero rows match `:hover` at any drag step, and the visible row order after the drop matches the expectation. No test reads the wrapper's props, the data attribute, or any dnd-kit internals.
- The single new seam is the per-frame drag-sampling e2e technique already proven on the dictionary tree: drive a real drag with the Playwright mouse, sample computed transforms and the `:hover` census every step, assert on the samples. jsdom is structurally blind to all of this (no layout, no transitions, no hover), so none of it is unit-tested — by design.
- The sampling utilities (drag driver, transform sampler, intermediate-position counter, hover census) are extracted from the existing dictionary drag spec into a shared e2e helper.
- Coverage is one spec per wiring shape, not per surface: flat list (a World Editor item list), depth-nesting tree (the trait tree, including an X-drag nesting assertion — the riskiest migration), dictionary tree (the existing spec, unchanged), and packed grid (the library tile grid). Identical wirings are not re-tested.
- Every new spec must be proven able to fail: reinstate the defect it guards (an inline items array, a removed hover guard) and watch it go red before trusting green. This bar was met by both existing dictionary drag guards and is the house rule.
- Reorder outcomes stay covered at the existing unit seams (the dictionary tree move/reorder library, the library drop-intent module, the array-move handlers). Those suites are untouched and must stay green through the migration.
- Prior art: the dictionary drag e2e spec (drag sampling), the library tiles e2e spec (grid interactions), the focus-ring spec (computed-style assertions).

## Out of Scope

- Virtualizing any further surface (the Test Bench instruments, memory ledger, play log, library grids). That is the separate virtualization inventory.
- The play log cap and any save-size work.
- Adopting dnd-kit's DragOverlay, changing drop animations, or redesigning any drag gesture.
- Touch-specific drag improvements beyond what each surface already does.
- Any change to drop semantics, collision outcomes, or reorder results.
- Test-only DndContext wrappers in unit tests; they are harnesses, not product wirings.

## Further Notes

- The twelve production wirings: the shared flat list, the World Editor per-tab item lists, the dictionary tree, the shared tree engine (entity/location/trait), the library tile grid, the save/folder dialog (two contexts), the installed-models list, the dictionary selection modal, keyword chips, image tags, and the token autocomplete.
- The e2e suite is deliberately separate from the four gates; the new specs extend `npm run test:e2e` and its serial, single-worker configuration.
- A parallel session is currently editing the library tile grid and its e2e spec. The grid migration should land last and rebase over that work; stage explicitly, never `git add -A`.
- The trait tree migration is the risk concentration: its no-bounding-clamp-on-X constraint is load-bearing for depth nesting and has bitten before. Its spec should exist before its migration, red-proven against a deliberately clamped X.
