# Collapsible Travel List

Status: ready-for-agent

## Problem Statement

The Change Location dialog's List view shows every location in the world at once. Now that each row also carries the place's description, a dense world reads as a wall: dozens of rows, most of them places the player has no immediate reason to visit, burying the handful of destinations the story has actually wired up from where they stand.

## Solution

Locations that hold sub-locations become collapsible in the List view, with a chevron to open and close each branch. By default, only the branches that matter from where the player is standing are open: the chain of places holding the current location, and any branch containing a one-hop destination — the same free-travel-plus-Connections set the narrator is given. Everything else starts collapsed, showing a muted count of what it hides. A well-wired world opens to a short list of likely destinations; the whole world is still one or two chevron clicks away.

## User Stories

1. As a player, I want locations with sub-locations to be collapsible in the travel list, so that a dense world doesn't read as a wall of rows.
2. As a player, I want branches holding my likely destinations expanded by default, so that the places the story wired up from here are visible at a glance.
3. As a player, I want the chain of places holding my current location always expanded by default, so that I can always see where I am standing.
4. As a player, I want a branch containing a Connection's far end expanded by default even when it sits across the world, so that an authored portal or passage surfaces its destination.
5. As a player, I want collapsed branches to show how many places they hide, so that a closed row never looks like a leaf.
6. As a player, I want to expand and collapse branches manually, so that I can hunt for a far-off place the defaults left hidden.
7. As a player, I want clicking a row to still travel there and close the dialog, so that collapsing never gets in the way of the trip itself.
8. As a player, I want the chevron to be its own target separate from the row, so that opening a branch never accidentally travels me into it.
9. As a mobile player, I want the chevron target large enough for a fingertip, so that expanding a branch on a touch screen is not a precision task.
10. As a player, I want the defaults recomputed each time the dialog opens, so that the open branches follow me around the world as I travel.
11. As a player, I want my manual toggles kept while the dialog stays open, so that a branch I opened doesn't snap shut while I am reading it.
12. As a player, I want the current location's row visible whatever is collapsed, so that the primary-colored marker is never hidden inside a closed branch.
13. As a player in a world with no Connections, I want the list to still open showing my nesting neighborhood, so that an unwired world remains navigable.
14. As a player using a screen reader, I want collapse state announced on each parent row, so that the tree's shape is readable without sight.
15. As a keyboard player, I want the chevron focusable and operable, so that branches open without a mouse.
16. As a player viewing a past turn, I want the list to behave the same as on the live turn, so that travel views never fork behavior by page.
17. As a world author, I want the default expansion driven by the same travel graph the narrator uses, so that wiring the world well directly tidies the player's travel list.

## Implementation Decisions

- **The default-collapsed set is one new pure function** taking the world's locations, its connections, and the current location id, returning the set of parent ids that start collapsed. A parent starts expanded when its subtree contains the current location or any one-hop destination of it (the effective-destinations set: surviving implicit neighbors plus Connections leaving the current location). All other parents start collapsed. A null current location (no game state) collapses nothing.
- **Row filtering reuses the existing collapsed-children filter** already used by the World Editor's list — collapsed ids in, visible flat rows out. No second tree-walking path.
- **Collapse state lives in the modal**, initialized from the pure function when the dialog opens and discarded when it closes. Nothing persists to storage, the save, or the world; reopening recomputes from wherever the player now stands.
- **The chevron is a separate control inside the row**, left of the name, rendered only on rows that hold children. It stops propagation so toggling never travels. Rows without children keep their current layout with space reserved so names stay aligned within a depth level.
- **Collapsed parents show a muted count** of the locations hidden beneath them (all descendants, not direct children), styled like the description line's muted treatment.
- **Accessibility:** parent rows carry expanded/collapsed state via the chevron's `aria-expanded`; rows keep their existing `aria-level`; the current row keeps `aria-current="location"`.
- **The Map view is untouched.** Collapse is a List-view idea only.
- **No export-shape or save-shape change.** Collapse state is ephemeral UI state.

## Testing Decisions

- Good tests here assert external behavior: which rows are visible, what the counts say, what a click does — never the internal set representation or render structure beyond the established seams (aria attributes, row text).
- **The default-collapse function is tested directly** as pure logic: current chain always expanded; a Connection across the world expanding the far branch's whole ancestor chain; unrelated branches collapsed; the no-Connections world expanding only the nesting neighborhood; null current location collapsing nothing.
- **The modal is tested through its existing render harness** (the same file that guards row order, depth, travel-and-close, and the description rows): chevron toggles visibility of a branch, chevron click does not travel, collapsed parent shows its descendant count, defaults applied on open, current row visible.
- Prior art: the existing Change Location dialog tests (tree order, aria-level, travel-and-close, description rows) and the location-tree unit tests around flattening and collapse filtering.
- Each new guard is mutation-tested per the project's test bar: reintroduce the bug (e.g. drop the ancestor-chain expansion, count direct children only, let chevron clicks travel) and watch the right test fail.

## Out of Scope

- Persisting collapse state across dialog opens or sessions.
- A search/filter box for big worlds (revisit if collapse plus counts proves insufficient).
- Any change to the Map view, the World Editor's location list, or the entity Locations picker.
- Spoiler control — descriptions and names of unvisited places remain visible, as decided earlier.
- Hover-expand animation for description rows (discussed and set aside).

## Further Notes

- Travel remains unrestricted (ADR-0006): expansion defaults are a reading aid, not a permission system. The arrows describe how the world is wired for the narrator, never where the player may go.
- The failure mode is the unwired world: everything-connects-to-everything expands fully and gains nothing. That is the author's tradeoff, not something the code should second-guess.
- The dialog reopens on whichever view (List/Map) was used last; collapse defaults apply whenever the List renders.
