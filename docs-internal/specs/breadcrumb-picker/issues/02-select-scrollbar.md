# 02: Scrollbar on Every Select

Status: ready-for-human
Base: 83502ab3
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

Every plain Select shows a scrollbar when its list is long, in the shared ScrollArea look, and loses its overlay chevron buttons (Q7, Q8).

- Undo Radix's scrollbar hiding on the Select viewport, so the global native scrollbar style applies. Don't wrap the viewport in a nested ScrollArea.
- Remove the two overlay scroll buttons. Wheel, drag and keys still scroll.
- Call sites that set their own max height keep it, such as the month and year picker. The segmented option switcher's mobile fallback gets the change through the shared Select.

## Acceptance criteria

- [x] A test confirms the scroll buttons are gone and a long list still scrolls to its last item by keyboard.
- [x] A verify-ui frame in both themes shows the scrollbar on a long Select. It matches the 10px arrowless thumb of a ScrollArea.
- [x] The first and last rows of a long list are never covered.
- [x] The four gates are green.

## Comments

Painted check (Browser pane, dev2): a viewport with Radix's injected `scrollbar-width:none` rule measured a 0px scrollbar. With the two classes it measured 10px, equal to a plain scrolling div under the global style. Both themes share one `::-webkit-scrollbar-thumb` rule that uses theme tokens. The pane would not render the settings dialog, so no full-app frame was taken.

Gates: typecheck and build green. Lint errors and the `traitGates` test failures all come from ticket 01's in-progress files. The full suite showed 4 failures, all in `src/lib/traitGates.test.ts`.
