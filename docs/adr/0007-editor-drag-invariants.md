# ADR-0007 — One drag layer holds the editor's drag invariants

**Status:** Accepted · **Date:** 2026-08-29

## Context

Every drag-and-drop list in the app used to wire its own dnd-kit context by hand. Twelve of them existed, and each re-typed the same rules: sensors, contained auto-scroll, a stable id array, hover suppression, and a Translate-only row transform.

The rules drifted, and three fixes had to be hand-carried across every surface:

| Fix | What went wrong |
|---|---|
| Translate, not Transform | `CSS.Transform` bakes in a scale, so the carried row resized to fit its target slot |
| Contained auto-scroll and the Y clamp | Dragging past the last row grew the scroll height, so auto-scroll chased the row into empty space forever |
| Stable items and hover suppression | Displaced rows snapped instead of sliding; rows lit up and popped tooltips under the moving cursor |

The last pair landed in the dictionary tree only. Authors got smooth, hover-quiet drags in one place and snapping, hover-lit drags everywhere else.

## Decision

One shared layer holds the rules, and every sortable surface renders through it.

- **`EditorDndContext`** supplies the defaults: a 5px pointer activation distance, keyboard sorting, `closestCenter` collision, the vertical-list clamps, and auto-scroll that only ever moves a real inner viewport — never the page, body, or document element.
- **`StableSortableContext`** takes the items themselves, not an id array, and holds one array reference for as long as the ids hold.
- Everything a surface legitimately varies is a prop: collision, modifiers, sensors, auto-scroll, measuring, and every drag callback.
- **Drop semantics stay with each surface.** The layer decides how a drag feels; the surface decides where it lands.

## The invariants, and why each one exists

**Items must be reference-stable.** dnd-kit compares a sortable context's items by reference. A fresh array on a mid-drag render reads as a whole new set, which drops every displaced row's 200ms sort transition to 0ms. `StableSortableContext` compares by content instead, so a caller that rebuilds its array every render still gets a stable one, and the trap cannot be re-opened from a call site.

**A depth-nesting tree must never take a bounding clamp on X.** A tree reads the drag's horizontal delta as the row's nesting depth. `restrictToVerticalAxis`, `restrictToFirstScrollableAncestor`, and `restrictToParentElement` all clamp that delta, which silently turns re-parenting into plain reordering — no error, just a gesture that stops working. Trees pass `restrictYToScrollAncestor`, which clamps Y alone and leaves X free.

**Hit-testing goes dark for the length of a drag.** One attribute on the layer's wrapper, one global CSS rule. Rows under the moving cursor would otherwise light their hover state and pop tooltips over the drop position. Drops are unaffected, because dnd-kit's collision is rect-based rather than hit-tested. The wrapper draws no box of its own (`display: contents`), so it never disturbs a surface's layout, and `pointer-events` reaches the rows by inheritance.

**Rows translate, they never transform.** `CSS.Transform` includes a scale that resizes the carried row to the target slot. This rule lives in the shared row components (`EditorRow` and each surface's sortable row); the drag layer never styles rows.

## Consequences

- A new sortable surface gets all of it by rendering through the layer. Nothing has to be remembered.
- The one thing a call site still has to know: the wrapper draws no box, so flex and grid layout pass through it, but CSS that selects direct children does not. A list spaced by `space-y-*` becomes `flex flex-col gap-*`, or its rows lose their gaps. The save browser and the installed-models list both needed that change.
- A surface with different needs passes props rather than forking the layer, so unusual gestures — the trait tree's re-parenting, the library grid's packed layout and long-press touch drag, the dictionary's cross-book zones — stay one wiring each.
- The rules are provable only in a real browser: jsdom has no layout, no transitions, and no hover. The guards live in the Playwright suite (`e2e/dragSampling.ts` plus one spec per wiring shape) and each one has been watched fail with its defect reinstated.

## Alternatives rejected

**Leave the wirings alone and copy each fix.** This is what produced the drift. Three fixes had already been carried by hand, and two of them stalled halfway.

**Put hover suppression in each surface's class list.** It is one line per surface, which is exactly how the last attempt reached only one of twelve.

**Give the layer a wrapper with a real box.** It would need per-surface layout props — the library grid's children are flex items of a parent outside the context — and every one of those is another chance to drift. `display: contents` costs nothing and stays invisible.
