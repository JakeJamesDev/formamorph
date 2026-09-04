# 04 — Snap To Grid & Canvas Prefs

**What to build:** The canvas gains a visible grid with snapping on by default. Node drags land on grid intersections; a toggle turns snapping off and another controls grid visibility. Both choices are per-user, app-side preferences (never part of the world export) — this ticket establishes the canvas-preferences settings home that later tickets (connection style) reuse. Grid cell size is implementation-chosen to harmonize with the existing layout gap; it is a constant later consumed by Auto Arrange.

Toggles are reachable now via the canvas context menu (the fullscreen toolbar duplicates them later).

**Blocked by:** None — can start immediately.

Status: done

- [x] A visible grid renders on the canvas by default
- [x] Dragged nodes snap to the grid; snapping off restores freeform placement
- [x] Snap and grid-visibility choices persist per user across sessions and never enter the world JSON
- [x] The canvas-prefs settings home exists with defaults registered the standard way
- [x] Toggles reachable from the canvas context menu
- [x] Playwright: a drag lands on-grid with snap on, off-grid with snap off
