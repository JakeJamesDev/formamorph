# 03: Canvas Picking Mode

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The approved variant D of the UI prototype (`prototype/entity-presence`, launch entry `prototype-entity-presence`). Rewrite it properly; don't copy the prototype code.

## What to build

On the full-screen Locations Canvas, an author picks an entity from an inspector card. The canvas becomes a read-only picker: the entity's locations show a pin and a solid tint, its Known In picks show a megaphone and a dashed outline over each subtree, and everything else fades. A click or tap toggles a location for the current mode, **Locations** or **Known In**. The card also holds Presence, Movement, Known In and the range warning. The entity panel holds no Presence fields, only a hint pointing at the canvas.

## Acceptance criteria

- [ ] The inspector card and all marks show on the full-screen canvas only. The embedded canvas shows neither.
- [ ] Marks: locations get a pin and solid tint; picks get a megaphone; each pick's subtree gets a dashed outline; other locations fade to 30%; Connections and their labels fade to 25%.
- [ ] While picking: no node drag or nesting, no Connection drawing or editing, no selection or marquee, no context menu (browser or canvas), no nudge keys, no toolbar. A drag with any mouse button pans. Find a Location, zoom and the minimap still work.
- [ ] Entering picking clears the editor's selection. Escape leaves picking first; a second Escape leaves full screen.
- [ ] The Locations / Known In toggle carries the pin and megaphone icons. Known In clicks write Known In picks; an empty list falls back to Nearby.
- [ ] The range warning shows for a Moves Between entity whose locations have no path through its own locations.
- [ ] Copy matches the spec's table; `copy:sweep` reports 0 notices.
- [ ] Undo covers every toggle made while picking.
- [ ] Verified with the verify-ui skill through a dev route, both themes.
