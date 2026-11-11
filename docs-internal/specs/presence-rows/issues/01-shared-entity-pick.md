# 01: Shared Entity Pick

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Locations Canvas picks an entity only in full screen, and the pick is private to the canvas. This ticket makes the pick shared state and lets the canvas beside the location panel show a pick without being a picker. No screen sets the pick outside full screen yet; ticket 02 does. Here the dev route proves it.

- **The pick is shared.** The picked entity, its mode (Routine or Known In) and the pending Picked Locations state live where the location panel and the canvas can both read and set them. One pick exists for the World Editor.
- **Two notions on the canvas.** "Picking" is today's full-screen behavior and does not change: a click on a location edits the pick, the toolbar hides, Escape leaves the pick. "Showing" is new: beside the panel, the canvas draws a pick and changes no interaction. A click on a location selects that location, boxes drag as before, Connections can be selected.
- **What showing draws.** The same as full screen draws for a picked entity: the routine view in place of the Connections, or the Known In marks, the canvas key, and the status line. No routine drag sources.
- **When it shows.** Beside the panel the canvas shows the pick only while a host says the pick is on show. Ticket 02 sets that from the Presence tab. Until then only the dev route sets it: `pick=<entity id>` without `fullscreen=1` shows the pick beside the panel.
- **Status text beside the panel.** It names the entity's routine, or the selected routine row. It offers no edit. An entity's name in it is the entity's label with placeholders resolved (Q18).
- **The card body.** The entity card's body for one entity (the mode switch, the hint, the Routine editor or the Known In field) becomes its own component. The card uses it. The card keeps its entity select and close button.
- **The carry (Q11).** Because the pick is shared, a pick made beside the panel is the card's entity on entering full screen, and a pick made in full screen is still set on leaving it.

The prototype lifted the pick this way: branch `prototype/presence-rows`. It is a guide, not code to copy.

Spec rulings: Q9, Q11, Q18.

## Acceptance criteria

- [ ] Full screen behaves as before: the existing full-screen pick, routine edit and Known In tests pass unchanged, apart from where the pick state is read.
- [ ] With a pick on show beside the panel, the canvas has the routine marks, the canvas key and the status line for a Unique entity, and the Known In marks and key in Known In mode.
- [ ] Beside the panel, a click on a location with a pick on show selects that location and writes nothing to the entity. The test fails when the click is routed to the routine edit.
- [ ] Beside the panel, no location is a routine drag source.
- [ ] With a pick set and not on show, the canvas beside the panel draws Connections only.
- [ ] The status line beside the panel shows the entity's label for an entity whose name holds a placeholder, and contains no `{{`.
- [ ] A pick shown beside the panel is the entity card's entity after Edit Full Screen. A pick made on the card is still set after leaving full screen.
- [ ] The dev-route note for the Locations tab documents `pick=` without `fullscreen=1`.
- [ ] Frames: `.scratch/frames/presence-pick-beside-panel-dark.png` and `-light.png`, at 1440 wide, on the `entityPresence` fixture with `pick=dev-sentry`.
- [ ] No wiki text and no changelog fragment change: an author sees no new behavior until ticket 02.
