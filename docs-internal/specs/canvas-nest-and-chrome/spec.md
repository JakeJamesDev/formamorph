# Canvas Leaf Nesting, Undo/Redo Chrome, and Menu Grouping

Status: ready-for-agent

## Problem Statement

On the location canvas, an author can drag a location into an existing group box to nest it — but there is no way to start a hierarchy by drag: dropping one location onto a plain (leaf) location does nothing, so the first nesting under any location has to be authored in the list tree instead. Undo and redo exist but are keyboard-only, invisible to anyone who doesn't know Ctrl+Z works here. And the right-click menu is one undifferentiated run of rows — actions, view switches, and the connection-style choice all blur together.

## Solution

Dragging a location over a leaf location and pausing briefly *arms* the leaf (highlight); releasing while armed nests the dragged location(s) inside it, turning the leaf into a group box. Undo/Redo become visible buttons at the end of the fullscreen toolbar and a leading group in every canvas context menu. The context menu gains separators dividing it into its natural categories: history, target actions, view switches, connection style.

## User Stories

1. As a world author, I want to drop one location onto another on the canvas, so that I can start a hierarchy without switching to the list tree.
2. As a world author, I want the target leaf to only arm after a brief hover, so that dragging past small nodes while tidying the map never nests by accident.
3. As a world author, I want the armed leaf visibly highlighted before I release, so that I can see the nest is about to happen and can bail by moving away.
4. As a world author, I want a drag that leaves the armed leaf to disarm it, so that only a deliberate release commits.
5. As a world author, I want a multi-selection dropped on an armed leaf to nest the whole selection, so that restructuring matches how multi-drag into groups already works.
6. As a world author, I want the dropped node(s) to stay where I released them, with the new group frame growing around them, so that the drop feels direct.
7. As a world author, I want existing group boxes to keep their instant containment drop, so that the behavior I already use doesn't change.
8. As a world author, I want a location I can't legally nest into (itself, its own descendant, a node riding along in the drag) to never arm, so that cycles remain impossible.
9. As a world author, I want authored Connections between the two locations left untouched by nesting, so that no aiHint text is silently destroyed.
10. As a world author, I want a leaf-nest to be one undoable step, so that Ctrl+Z (or the new Undo button) puts both locations back exactly.
11. As a world author, I want Undo and Redo buttons at the end of the fullscreen toolbar, so that I can walk edits back without knowing the shortcut.
12. As a world author, I want those buttons disabled when their stack is empty, so that I can see at a glance whether there is anything to walk back.
13. As a world author, I want Undo and Redo as the leading group of the right-click menu on the pane, a node, and a selection alike, so that undo is reachable wherever the menu opens — including the embedded canvas, which has no toolbar.
14. As a world author, I want empty-stack menu rows greyed out rather than hidden, so that the menu layout is stable and teaches me undo exists here.
15. As a world author, I want separators between the menu's categories, so that actions, view switches, and the connection-style choice read as distinct groups.
16. As a screen-reader user, I want separators exposed with the separator role and disabled rows announced as disabled, so that the menu's structure is audible, not just visual.
17. As a touch-device author, I want the dwell-to-arm to work from a touch drag the same as a mouse drag, so that nesting isn't mouse-only.

## Implementation Decisions

- **Scope is the canvas only.** The list tree's depth-drag nesting is untouched; no other surface changes.
- **Leaf arming is a dwell.** During a node drag, hovering a leaf location for a short dwell arms it; moving off disarms. Groups keep today's instant center-point containment commit. The dwell *timer* lives in the canvas component; the pure drop logic receives the armed target as an input and decides the drop, keeping the logic clock-free and testable.
- **Candidate detection extends the existing pure hit-testing.** The same center-point containment test that finds group targets also reports the leaf under the drag as an arming candidate, with the same exclusions (self, descendants of the dragged node, nodes carried by the drag). Innermost target still wins.
- **Placement is at the drop point.** The dropped node keeps its release position, converted to parent-relative coordinates; the new group's frame derives from its children via the existing measure/overshoot logic. No auto-arrange on drop.
- **Multi-select nests the whole selection**, through the same multi-drop path group drops use today.
- **Connections between the nested pair are not edited.** Parent–child travel is already implicit; the redundant authored connection simply stops rendering a line (existing behavior) and survives un-nesting.
- **Undo/Redo toolbar buttons** are an icon pair (with a preceding separator) trailing the fullscreen toolbar, disabled when the corresponding stack is empty. They call the same history the keyboard shortcuts use. Fullscreen only — the embedded pane stays chrome-free.
- **Undo/Redo menu rows** lead all three context-menu targets (pane, node, selection) as their own group, greyed out (disabled, not hidden) when empty.
- **Menu grouping**: history | target actions | Snap To Grid + Show Grid | connection-style radio trio, divided by separators. The menu row model grows a disabled notion and the menu a section notion; a pure section-builder assembles the grouped rows from the target kind, settings, and history state, and the menu component renders sections with separators between them.
- **The toolbar-mirrors-menu contract holds**: every toolbar control, including the new pair, remains a second place to reach something the menu offers.
- No world or save export-shape changes; `parentId` and `canvasPosition` are existing fields.

## Testing Decisions

- Good tests here call the pure functions with location fixtures and assert on returned intents/sections — external behavior, no component internals, no timers.
- **Drop logic**: extend the existing pure drop-logic test suite — leaf candidate reported under the drag center; armed leaf drop produces a reparent intent with drop-point-relative position; unarmed leaf drop is a plain move; self/descendant/carried nodes never candidates; multi-drop nests the selection; group behavior unchanged (regression cases stay green).
- **Menu sections**: new tests for the pure section-builder — group order and separator boundaries per target kind, undo/redo rows present on all three targets and disabled exactly when the history stack side is empty, settings rows carry their checked state.
- **Prior art**: the existing locationCanvas drop-logic tests and canvasHistory tests; same fixture style.
- Toolbar buttons and the dwell highlight are verified in the live preview via the dev-router fullscreen route, static-frame evidence only.

## Out of Scope

- Any change to the list tree's nesting interaction.
- Reworking the existing group-drop gesture (no dwell added there).
- Automatic cleanup of connections made redundant by nesting.
- Undo/redo chrome on the embedded pane beyond the context menu.
- Configurable dwell duration.

## Further Notes

- The dwell duration is an implementation constant; pick something in the long-press neighborhood already used for touch holds and tune in preview.
- Nesting the first child flips a leaf's rendering to the group-box node type via the existing rebuild-from-world path; no new node type is needed.
- Un-nesting already works (drag to the top-level drop surface) and is not part of this change.
