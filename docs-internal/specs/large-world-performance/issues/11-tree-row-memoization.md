# 11: Tree Row Memoization

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: touches the shared sortable tree used by four surfaces under ADR-0007.

## What to build

Editor trees stop re-rendering every row on every edit and every drag move. The shared sortable tree memoizes its visible-row list per surface and renders rows through a memoized row component with stable callbacks. The drag-move handler updates the projected depth only when the depth changes. Rows share one placeholder vocabulary per render instead of building it per row. ADR-0007 holds. No visible change. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] Editing one entity's name re-renders that row only (render-count test through the public tree seam).
- [ ] A drag move that does not change depth does not re-render the tree.
- [ ] Entity, location, trait and placeholder tree tests and the editor-list and trait-tree drag e2e specs pass unchanged.
- [ ] Harness `treeDrag` and `typing` steps improve; numbers recorded.
- [ ] Guard bites: un-memoizing the row turns the render-count test red.
- [ ] Four gates green.
