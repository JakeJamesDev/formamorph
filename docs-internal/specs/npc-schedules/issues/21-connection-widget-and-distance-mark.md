# 21: Connection Widget And Distance Mark

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A Connection has three things to set: which way travel runs, how far apart the pair is, and the Travel Hints. Today the location panel and the full-screen canvas each lay these out by hand, with two unlabeled switches. Build one widget for the three fields and use it in both places.

This ticket owns the shared widget and the distance mark. Ticket 22 wraps the widget in a fold.

- **Travel:** a label, then a three-choice segmented control. Each choice is an icon and a word: both ways, to there, to here. No line of text under it. On the canvas the pair has no "here", so the canvas keeps naming the two ends in its tooltips.
- **Distance:** a label with an ⓘ, then a two-choice segmented control. It is two thirds of the row wide, so its choices line up under the first two Travel choices and the third slot is empty. Each choice shows the distance mark. No line of text under it.
- **Distance mark:** a line, then the word, in one fixed width, so the shorter word gets the longer line. Nearby is a short straight line. Far is a dotted sine wave with few humps. It draws in the current text color. It is one component; ticket 22 puts it in the row header.
- **Distance ⓘ:** the full explanation of Nearby and Far. It must say what the AI is told about the other end, who the narration can call over, and that travel works either way. Write it from a facts list in the user's words (Writing Guide, "Before you write"), then run the copy sweep.
- **Travel Hints:** the two hint boxes with their "To X" and "From X" labels and the link button, with no group label above them. The link button spans from the top of the first box to the bottom of the second; it does not cover the first label.

The widget takes a Connection and hands back a rewritten Connection. The location panel keeps writing through the editor's Connection update, and the canvas keeps its intents. No new write path, and no world or save shape change.

The prototype has the look: branch `prototype/connection-rows`, variant B4. Read it for the layout and the mark; rewrite it properly. Its text boxes, sample data and local state are throwaway. The spec's Further Notes say how to run it.

The distance mark is a new visual pattern, approved on 2026-11-10 (Q185). Add it and the widget to the Design System page and its showcase.

Spec rulings: Q179, Q183, Q185, Q186, Q187, Q188.

## Acceptance criteria

- [x] The location panel's Connections list and the canvas Connection panel render the same widget, shown by a component test on each surface that finds Travel, Distance and the hint boxes. *("shows the Connection widget" in `LocationConnections.test.tsx` and `ConnectionInspector.test.tsx`.)*
- [x] Each Travel choice and each Distance choice rewrites the record as before, on both surfaces. Re-clicking the active choice changes nothing. *(Choice tests on both surfaces; "changes nothing when the active … choice is clicked again" on both went red with the guard removed.)*
- [x] The Distance control's two choices have the width of the first two Travel choices, checked by measured widths in the preview at 1440 and at the narrowest panel width. *(Edges match to 0.01 px: panel at 1440, panel at 768 (304 px group, the narrowest), canvas at 1440.)*
- [x] The line under the Distance control and the line under the Travel control are gone. The ⓘ opens the explanation. *(`DISTANCE_HINTS` deleted; ⓘ opened in the preview inside the World Editor.)*
- [x] The link button's top edge is the first hint box's top edge and its bottom edge is the second box's bottom edge, checked by measured positions in the preview. *(Panel 886.67–994.67, canvas 274.67–382.67, equal to the boxes' outer edges.)*
- [x] Frames: `.scratch/frames/connection-widget-panel-dark.png`, `-panel-light.png`, `-canvas-dark.png`, `-canvas-light.png`, at 1440 wide.
- [x] The Design System page documents the distance mark and the Connection widget, and the showcase shows both values of the mark. *(Two new patterns; `tab=connection-widget` DOM read shows both marks.)*
- [x] The Locations wiki page and the changelog fragment describe the new controls. A help topic that names the old switches is updated, and the help vectors are rebuilt if one changed. *(World-Editor-Locations.md; `build:help-vectors` re-embedded 3 sections.)*

For you: read the Distance ⓘ text in the location panel and say whether it explains Nearby and Far well enough.
For you: look at the Far wave in both themes and say whether it is calm enough.

## Landed

**Not verified**

- None.

**For you**

- For you: read the Distance ⓘ text in the location panel and say whether it explains Nearby and Far well enough.
- For you: look at the Far wave in both themes and say whether it is calm enough.
- Frames: `.scratch/npc-schedules-21/frames/connection-widget-panel-dark.png`, `-panel-light.png`, `-canvas-dark.png`, `-canvas-light.png`.
- Follow-up to decide: `directionIntent` and `distanceIntent` in `src/lib/locationCanvas.ts` are now used only by tests. The canvas sends `updateIntent` with the widget's rewritten record.
