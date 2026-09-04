# Locations Canvas — Second Pass

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

The first canvas pass (see `docs-internal/specs/location-graph/spec.md`) shipped the surface but its editing ergonomics undermine it. Layout feels random: unplaced nodes reflow live around placed ones, moved nodes permanently leave the automatic layout, and there is no way back to a tidy arrangement. A child dragged left of its Group's padding snaps back instead of growing the Group. Controls fight convention: left-drag both moves nodes and pans, right-click opens the browser menu, there is no multi-selection, no snap-to-grid, no undo — every layout decision is final short of discarding all world changes. Connections render only as straight lines, an authored parent↔child Connection anchors to the child's center instead of its border, reparenting gives zero feedback until the drop lands, and there is no fullscreen mode for serious layout work.

## Solution

The canvas becomes a **manual-first** node editor (ADR-0004): positions are author-owned and stable, every location gets a concrete position at creation, and the live reflow dies. **Auto Arrange** — a dagre layered layout over the travel graph, invoked per Group from a right-click context menu or the fullscreen toolbar — is the only automatic layout, and it hands positions back to the author. Standard node-editor controls arrive (marquee multi-select, middle/right-drag pan, right-click menu), plus snap-to-grid on a visible grid, three connection styles, a canvas-scoped undo stack, live reparent highlighting, Groups that grow in every direction, and a fullscreen mode (reusing `FullscreenShell`) that carries the power chrome — toolbar, minimap, search, align/distribute — while the embedded view stays clean for quick adjustments.

## User Stories

### Layout ownership

1. As a world author, I want nodes to stay exactly where I left them, so that arranging the canvas never feels random.
2. As a world author, I want a new location to appear at a sensible spot without disturbing anything else, so that adding content doesn't shuffle my layout.
3. As a world author, I want to right-click a Group and Auto Arrange its direct children, so that I can tidy one area without touching the rest.
4. As a world author, I want Auto Arrange to place connected locations near each other with few crossing arrows, so that the arranged result is actually more readable, not just aligned.
5. As a world author, I want an Auto Arrange All command on the canvas background, so that I can reset the entire layout (root and all nested Groups) in one action.
6. As a world author, I want to drag a child left of or above its Group's edge and have the Group grow around it, so that layout isn't confined to a top-left quadrant.
7. As a world author, I want a Group growing in one direction to leave its other children visually in place, so that expansion never reads as movement.

### Grid & styles

8. As a world author, I want snapping to a visible grid, on by default, so that hand-placed nodes line up without pixel fiddling.
9. As a world author, I want to toggle snap and grid visibility, and have my choice remembered, so that freeform placement is available when I want it.
10. As a world author, I want Auto Arrange output to land on the grid, so that automatic and manual layout share one visual rhythm.
11. As a world author, I want to choose between straight, bezier, and elbow connection lines, so that the canvas can match how I read graphs. Straight stays the default; dashed-implicit vs solid-authored survives in every style.
12. As a world author, I want an authored parent↔child Connection drawn border-to-border, so that arrows never plunge to a node's center.

### Controls & selection

13. As a world author, I want left-drag on empty canvas to rubber-band-select nodes, so that multi-selection is direct.
14. As a world author, I want Shift+click to add or remove nodes from the selection, so that I can compose selections precisely.
15. As a world author, I want to drag a multi-selection as one unit, so that arranged clusters move together.
16. As a world author, I want middle-drag or right-drag to pan, so that navigation and selection stop competing for left-drag.
17. As a world author, I want right-click (without drag) to open a canvas context menu instead of the browser menu, so that per-Group and per-selection actions are one click away.
18. As a world author, I want keyboard shortcuts — F to zoom to selection, Ctrl+A to select all, arrow keys to nudge the selection one grid cell, Esc to clear — so that fine adjustment doesn't require the mouse.

### Undo & feedback

19. As a world author, I want Ctrl+Z / Ctrl+Y over my canvas edits (moves, reparents, connection edits, Auto Arrange), so that no layout decision is final.
20. As a world author, I want Auto Arrange to undo as a single step, so that undoing a bad arrangement doesn't take dozens of presses.
21. As a world author, I want the prospective parent Group highlighted while I drag a node over it, so that reparenting is legible before I drop.
22. As a world author, I want dropping outside every Group to visibly read as "top level", so that unparenting is as legible as parenting.

### Fullscreen

23. As a world author, I want a fullscreen mode for the canvas, so that serious layout work gets the whole screen.
24. As a world author, I want the embedded canvas to stay minimal — full interactions, but only zoom controls and a fullscreen button — so that the quick view stays clean and readable.
25. As a world author, I want the fullscreen chrome to carry the power tools — toolbar (Auto Arrange, snap toggle, style picker, align/distribute), minimap, and location search — so that heavy editing has everything in reach.
26. As a world author, I want the search box to pan/zoom to the matched location and flash it, so that finding one node in a big world is instant.
27. As a world author, I want align (left/top) and distribute (horizontal/vertical) on a multi-selection, so that manual layout has the same finish as Auto Arrange.

## Implementation Decisions

**Paradigm** (ADR-0004): manual-first. Creation in the editor writes `canvasPosition` immediately via a deterministic placement heuristic (below the Group's existing content). Legacy/imported locations lacking positions get a deterministic fallback at canvas build — never reactive to authored positions, never dirtying the world by itself; positions persist when the author moves or arranges. The reactive `flow()` re-layout is deleted.

**Auto Arrange**: dagre (new dependency, MIT, ~30KB) over each Group's direct children, treating authored Connections and implicit sibling links as layout edges; output snapped to the grid and written as ordinary positions. Per-Group scope arranges direct children only (nested Groups keep their internals, sizes adapt). "Auto Arrange All" on the canvas background is the recursive variant. Invocation: right-click context menu (Group → Arrange, background → Arrange All, multi-selection → align/distribute) plus fullscreen-toolbar buttons.

**Group growth**: a child dragged past the Group's inner top/left bound expands the Group — the Group's origin shifts and siblings' relative coordinates are rebased so nothing visually moves. The existing min-clamp (`GROUP_PADDING`/`GROUP_HEADER`) becomes the rebase trigger instead of a wall. Right/bottom growth already works.

**Input scheme** (xyflow config): `panOnDrag: [1, 2]` (middle + right), `selectionOnDrag: true` with left, `onPaneContextMenu`/`onNodeContextMenu` suppress the native menu and open ours (right-*click* only — a right-drag pan must not open it on release). Wheel zoom stays. Multi-select via marquee + Shift/Ctrl-click; the canvas owns multi-selection state; the WorldEditor's `selectedItemId` continues to track single selection (last-selected). Multi-drag reparents by the same innermost-Group rule applied per node.

**Snap & grid**: xyflow `snapToGrid` + `snapGrid` (size implementation-chosen, ~20px, matching `LAYOUT_GAP` harmony), `<Background>` rendered as the visible grid. Defaults: snap on, grid visible.

**Connection styles**: three renderers behind the existing `FloatingEdge` seam — straight (default, current), bezier, elbow (orthogonal). Style is a per-user setting. Fix `borderPoint()` for the Group case so an authored parent↔child Connection anchors on both borders (child border ↔ Group inner border).

**Preferences**: snap, grid visibility, and connection style are per-user, app-side (settings/localStorage, defaults in `settingsDefaults.ts` if promoted to real settings). Nothing enters the world export.

**Undo/redo**: canvas-scoped command stack — inverse patches over the world's `locations`/`connections` slices via GameDataContext, Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) while the canvas has focus. Covers move, multi-move, reparent, connection create/edit/delete, Auto Arrange (one step). Session-only, capped (~100). Save does not clear it; undoing past a save just re-dirties. Editor-wide undo is explicitly out of scope.

**Reparent feedback**: during drag, run the existing `dropIntent` logic live and highlight the prospective target Group (and an explicit top-level affordance when clear of all Groups). Judgment at drop stays in `dropIntent` — the highlight and the commit must share one code path so they can't disagree.

**Fullscreen**: reuse `FullscreenShell` / `useMorphFullscreen`. Embedded chrome: zoom controls + fullscreen button only (snap silently honors the setting; context menu still available). Fullscreen adds: toolbar (Auto Arrange, snap/grid toggles, style picker, align/distribute), themed xyflow `MiniMap`, and the location search box.

**Vocabulary** (CONTEXT.md): **Group** — the rendered frame of a container location; containment is the frame, never lines (avoid "box"). **Auto Arrange** — the explicit command; the only automatic layout. **Locations Canvas** — the surface itself.

**Sequencing** — slices, each landing with gates green:
- **A. Controls** — input scheme, marquee/Shift multi-select, multi-drag, pan remap, context-menu shell, Esc/Ctrl+A.
- **B. Manual-first core** — creation placement, deterministic fallback, delete reactive flow, Group growth/rebase, Auto Arrange (dagre) + Arrange All, context-menu wiring.
- **C. Presentation** — snap + visible grid, per-user prefs, three edge styles, Group border-anchor fix, reparent drag highlight.
- **D. Undo** — command stack, keybindings, Auto-Arrange-as-one-step.
- **E. Fullscreen** — FullscreenShell integration, toolbar, minimap, search, align/distribute, F-to-zoom, arrow nudge.

## Testing Decisions

External behavior at the established seams, per the house test bar (guards proven by reinstating the bug; no scenario rigging):

1. **Mapper/pure layer** (`locationCanvas.test.ts` style): creation-placement determinism (same world → same fallback positions, placed siblings do not perturb it); Group growth rebase (child past bound → origin shift, siblings' absolute positions unchanged); Auto Arrange scope (direct children only; nested Group internals untouched; output on-grid; deterministic for a fixed world); multi-drop intents; Group-case border anchoring (both endpoints on borders); undo inverse-patch round-trips (apply → undo ≡ identity, Auto Arrange one step).
2. **Playwright** (`e2e/location-canvas.spec.ts` style): marquee selects multiple nodes and drags them as a unit; right-click opens the canvas menu (not the browser's) and right-drag pans without opening it; reparent drag highlights the target Group before drop; fullscreen opens with toolbar/minimap and the embedded view shows neither; Ctrl+Z reverts a real drag and the list view agrees.
3. **No motion/timing assertions**; static-frame and DOM evidence only, via the dev-router subtab route.

## Out of Scope

- **Editor-wide undo** — the canvas stack is not designed as a general world-data command log this pass.
- **Per-world canvas presentation** in the export — all prefs are per-user.
- **Edge routing around nodes** (obstacle avoidance) — styles change geometry, not routing intelligence.
- **Runtime graph changes during play** — still excluded (pass-1 spec).
- **Version bump / changelog finalization** — user-managed.

## Further Notes

- ADR-0004 records the paradigm decision and the dagre dependency; this spec defers to it on rationale.
- **Export note for the user**: no shape change — `canvasPosition` already exists as optional — but manual-first means exports become position-dense (every location populated after arranging). Flag at release time.
- The pass-1 spec's story 21 ("no parent↔child lines — the box is the relationship") governs *implicit* containment only; authored parent↔child Connections do render, border-to-border (the open ambiguity from the connection-editing commit, now resolved).
- `deleteKeyCode={null}` stays — Delete on the canvas still deliberately does nothing; location deletion remains a list-view action.
