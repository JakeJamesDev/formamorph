# 08 — Canvas Undo/Redo

**What to build:** Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) while the canvas has focus undo and redo canvas edits: node moves (including multi-drags as one step), reparents, connection create/edit/delete, and Auto Arrange — which reverts as a single step no matter how many positions it rewrote. Implemented as a canvas-scoped stack of inverse patches over the world's locations/connections data, session-only and capped (~100 steps). Saving does not clear the stack; undoing past a save simply re-dirties the world. Editor-wide undo stays out of scope; the list view reflects undone changes because both surfaces read the same world data.

**Blocked by:** 02 (stable position ownership), 06 (Auto Arrange exists to undo as one step).

Status: done

- [x] Ctrl+Z reverts the last canvas edit; Ctrl+Y / Ctrl+Shift+Z re-applies it
- [x] A multi-drag and an Auto Arrange each undo as exactly one step
- [x] Reparents and connection create/edit/delete are undoable; the list view agrees after undo
- [x] Stack is session-only, capped, and survives a save (undo after save re-dirties)
- [x] Shortcuts fire only with canvas focus — no collision with text inputs elsewhere
- [x] Pure tests: apply→undo round-trips to identity per edit kind; Playwright: Ctrl+Z reverts a real drag
