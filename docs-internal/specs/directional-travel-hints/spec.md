# Directional Travel Hints

Status: ready-for-agent
Spec session: directional-travel-hints — spec

## Problem Statement

A two-way Connection has one Travel Hint. The narrator gets the same hint for both directions. Many trips need different words each way: "up the survey steps" is wrong for the trip back down. Today the author must pick one hint that fits both directions, or make two one-way Connections. Two one-way Connections are harder to see and edit on the Locations Canvas.

## Solution

Each direction of a Connection has its own Travel Hint. The narrator gets the hint for the direction the player travels.

In the editor, a two-way Connection shows two Travel Hint boxes, one for each direction. A vertical link toggle sits to the right of the two boxes and spans them both:

- **Linked:** the first hint applies to both directions. The second box is read-only and shows the first box's text, so the copy is easy to see.
- **Unlinked:** both boxes are editable and hold separate hints.

A new two-way Connection starts linked. An author who writes one hint therefore gets it in both directions, as before. The link state is not saved. The editor derives it from the data each time the panel opens.

## User Stories

### Author

1. As an author, I want a separate Travel Hint for each direction of a two-way Connection, so that the narrator describes the trip up and the trip down differently.
2. As an author, I want a new two-way Connection to start with the hints linked, so that one hint covers both directions until I choose otherwise.
3. As an author, I want the second box to show the first box's text while linked, so that I can see the hint applies both ways.
4. As an author, I want the second box to be read-only while linked, so that I don't type into a box that has no effect.
5. As an author, I want to unlink the hints with one click, so that I can write a different hint for the return trip.
6. As an author, I want unlinking to give back the text the second box held before I linked it, so that a misclick does not lose my writing.
7. As an author, I want linking to copy the first hint into the second direction, so that the narrator gets the text I see.
8. As an author, I want the link toggle to the right of both boxes and drawn vertically, so that it reads as joining the two boxes.
9. As an author, I want the toggle to show a link icon when linked and a broken-link icon when unlinked, so that I can see the state at a glance.
10. As an author, I want a tooltip on the toggle (**Link Travel Hints** / **Unlink Travel Hints**), so that I know what a click will do.
11. As an author, I want each hint box labeled with its direction, so that I know which trip each hint describes.
12. As an author, I want a one-way Connection to show one hint box and no link toggle, so that the panel shows only controls that do something.
13. As an author, I want switching a one-way Connection to two-way to add the second box, linked, so that the return trip gets the existing hint by default.
14. As an author, I want switching a two-way Connection to one-way to keep the hint for the direction that remains, so that I don't lose that text.
15. As an author, I want flipping a one-way Connection's direction to keep the hint with the leg, so that the hint stays with the trip I wrote it for.
16. As an author, I want a Connection with the same hint in both directions to open linked after a reload, so that the editor shows the state my data describes.
17. As an author, I want a Connection with different hints to open unlinked after a reload, so that I see and can edit both hints.
18. As an author, I want link, unlink, and every hint edit to be undoable on the Locations Canvas, so that the toggle behaves like any other edit.
19. As an author, I want each arrow on the Locations Canvas to show its own direction's hint as its label, so that the map shows how each trip is made.
20. As an author, I want clicking one arrow of a two-way Connection to focus that direction's hint box, so that I edit the trip I clicked.
21. As an author, I want the location panel's Connections list to use the same hint pair and toggle as the canvas inspector, so that one pattern works in both places.
22. As an author, I want the location panel to label the boxes from that location's point of view (**To** a partner, **From** a partner), so that the labels match the location I am editing.
23. As an author, I want my existing worlds to keep their hints after the update, so that a two-way Connection's hint still applies to both directions.
24. As an author, I want an imported world in the old shape to open with its hints in place, so that shared worlds keep working.

### Player

25. As a player, I want the narrator to describe the trip in the direction I travel, so that the story matches where I go.
26. As a player, I want a trip with no hint in its direction to be narrated without one, so that the narrator does not use the other direction's words.

### Keyboard and screen-reader user

27. As a keyboard user, I want the link toggle in the tab order after the two boxes, so that I can reach it without a mouse.
28. As a screen-reader user, I want the toggle to announce its pressed state, so that I know whether the hints are linked.
29. As a screen-reader user, I want the read-only box to say that it copies the first hint, so that I understand why I can't edit it.

## Implementation Decisions

### Data shape

- A Connection is one record per pair of locations, with one optional leg for each direction. A leg that is present means travel is possible in that direction. The leg carries that direction's hint.

  ```ts
  interface Connection {
    id: string;
    a: string;
    b: string;
    aToB?: { hint?: string };
    bToA?: { hint?: string };
  }
  ```

- `twoWay`, `from`, `to`, and the single `aiHint` go away. `a` and `b` are neutral names because a Connection can run only `b → a`.
- A record with no legs is invalid. Import drops it. The editor never creates one.
- A blank or whitespace-only hint drops the `hint` field, as `withHint` does today. There is one shape for "no hint".
- Two one-way records per pair were rejected. The pair is the unit in ADR-0002, the canvas draws per pair, and two records allow duplicates and half-deleted pairs.
- ADR-0002 still holds unchanged: a Connection between a pair replaces that pair's Implicit Navigation.

### Migration

- A new `migrateWorld` step converts `{from, to, twoWay, aiHint}` to `{a: from, b: to, aToB: {hint}, bToA: twoWay ? {hint} : undefined}`. The old hint goes into both legs of a two-way Connection, so shipped worlds play the same.
- The step is idempotent: a record already in the new shape passes through.
- Saves hold no copy of Connections. A save plays against the world loaded through `migrateWorld`, so the world step covers saves (ruling from ticket 01).
- The bundled worlds that contain Connections are rewritten to the new shape.

### Navigation and prompt

- `effectiveDestinations` in the location graph reports which leg reaches each destination. The destination entry's hint is that leg's hint.
- A leg with no hint gives no hint. There is no fallback to the other leg.

### Editing module

- The connection-editing module gets pure functions for the new shape: set the direction (two-way, one way from a location, one way to a location), set a leg's hint, link, and unlink.
- Setting a direction keeps each leg's hint with its leg. Switching to one-way drops the removed leg. Switching one-way to two-way adds the new leg with the existing leg's hint (the linked default).
- A flip of a one-way Connection moves the leg. It does not rewrite `a`/`b`.
- **Link** writes the first leg's hint into the second leg. **Unlink** writes a given text back into the second leg. The caller supplies that text.
- A pure function derives the initial link state: linked when both legs exist and their hints are equal (both absent counts as equal).

### Travel Hint pair component

- One new shared component renders the hint boxes and the link toggle. The canvas inspector and the location panel's Connections list both use it.
- Layout: the two boxes stack. The toggle sits to the right of both and spans their full height. The icon is a vertical chain: link when linked, broken link when unlinked (the lucide `link` / `unlink` pair, turned upright by -45° so the chain stays vertical; user ruling in ticket 02).
- The toggle is a button with `aria-pressed`. Tooltips: **Link Travel Hints** / **Unlink Travel Hints**.
- The component holds the second box's pre-link text in memory, keyed by Connection id, for as long as it is mounted. That text is never saved. Closing the panel or reloading loses it. This trade-off is accepted.
- The link state is not stored in the world. It is derived when the component mounts and then held in component state.
- Box labels:
  - Canvas inspector: an arrow icon plus the destination name for each leg.
  - Location panel: **To** *partner* for the leg leaving the location, **From** *partner* for the leg arriving.
- Placeholder text keeps the existing "Travel Hint, e.g. through the shimmering portal" pattern.

### Locations Canvas

- Each leg is one arrow, as today. When both legs' hints are equal (both absent counts), the pair draws one shared label. When they differ, each label sits on the outer side of its own arrow, offset away from the partner arrow. The user approved this placement (ruling from ticket 01).
- Clicking an arrow selects its Connection and focuses that leg's box in the inspector.
- Link, unlink, and hint edits go through the canvas intent and history path, so undo covers them. A run of keystrokes in one box stays one undo step.

### Other readers

- The Authoring Tour steps and in-play checks, the design-system canvas reference fixtures, and the Locations Canvas builder move to the new shape.
- The Authoring Tour's Connection step keeps its In Play lens at the first location, so In Play reads the leg toward the second location. Tour text that quotes the hint reads that same leg. The linked default from the link toggle makes the top box reach In Play (ruling from ticket 01).

### Design System

- The Travel Hint pair with a vertical link toggle is a new visual pattern. The user approved it for this spec. It gets an entry in the Design System doc and the dev-router showcase.

## Testing Decisions

- Tests check external behavior: returned records, destination entries, and what the author sees and can do. They do not check internal state or call order.
- **Connection-editing module** (pure functions): direction changes keep hints with their legs; flip moves the leg; link copies; unlink restores the given text; blank hints drop the field; the derived link state for equal, different, absent, and one-way cases. Prior art: the existing connection-editing tests.
- **Location context** (destination entries): each direction gets its own leg's hint; a leg with no hint gives no hint even when the other leg has one; a one-way Connection offers no return trip. Prior art: the location-context and location-graph tests.
- **Migration**: old two-way records put the hint in both legs; old one-way records map to one leg; new-shape records pass through; records with no legs are dropped. Prior art: the version tests.
- **Travel Hint pair component**, tested through the location panel's Connections list: a new two-way Connection opens linked with a read-only second box that shows the first box's text; unlink makes both editable and restores the earlier text; different hints open unlinked; a one-way Connection shows one box and no toggle; the toggle reports `aria-pressed`. Prior art: the LocationConnections RTL tests.
- **Locations Canvas builder**: equal hints give one shared label; different hints give one label per arrow, each on its arrow's outer side. Prior art: the location-canvas tests.
- Each guard must bite: reinstate the single-hint behavior and confirm the direction tests fail.

## Out of Scope

- Saving the link state in the world.
- Keeping the pre-link text across panel close or reload.
- A hint fallback from one leg to the other at play time.
- More than two locations per Connection, or conditional legs (for example a leg gated by a stat or trait).
- Changes to Implicit Navigation or ADR-0002.
- A Playwright end-to-end test.

## Further Notes

- ⚠️ **Export shape:** this replaces the shape of `connections[]` in world `.json`. The `migrateWorld` step keeps old files loading.
- Update the glossary entry for **Connection** in `CONTEXT.md` to mention legs and the per-direction Travel Hint.
- The wiki page that documents Connections needs the new hint pair and link toggle.
