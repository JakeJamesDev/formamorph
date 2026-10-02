# 02: Scrollbar on Every Select

Status: ready-for-agent
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

- [ ] A test confirms the scroll buttons are gone and a long list still scrolls to its last item by keyboard.
- [ ] A verify-ui frame in both themes shows the scrollbar on a long Select. It matches the 10px arrowless thumb of a ScrollArea.
- [ ] The first and last rows of a long list are never covered.
- [ ] The four gates are green.
