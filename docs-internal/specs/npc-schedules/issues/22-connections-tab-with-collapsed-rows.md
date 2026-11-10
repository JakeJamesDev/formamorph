# 22: Connections Tab With Collapsed Rows

Status: ready-for-agent
Blocked by: 21
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A location's Connections move from the bottom of the Presence tab to a tab of their own, and each Connection becomes a row that folds. A long list is readable because every row starts closed.

- **The tab:** Connections, right after Presence, in Simple and Advanced. It holds the Connections list and the "Connect to" picker. Presence keeps Entities, the entities that are here, and Known Here.
- **A closed row** shows, in order: the fold chevron, the direction icon, the other location's name, the distance mark, and Delete. No "one way" text and no hint marker. The distance mark is read-only here.
- **An open row** shows ticket 21's widget under that header.
- **Fold state:** every row starts closed, whatever the count. A click on the header opens or closes it. A new Connection opens when it is added. The tab has the Collapse All button the Openings list uses. The state lasts while the tab is mounted and is stored nowhere. Do not use the open-below-three rule of the shared card-collapse hook.
- **Everything that points at the old place follows:** the search's tab-for-field lookup sends a Travel Hint to Connections, the dev-router ledger lists the new tab, and the Authoring Tour's Connection step opens it.

The prototype has the look: branch `prototype/connection-rows`, variant B4. Rewrite it properly.

Spec rulings: Q175, Q177, Q184.

## Acceptance criteria

- [ ] The Presence tab has no Connections block, and the Connections tab lists the location's Connections with the picker under them.
- [ ] Every row is closed on open, with one Connection and with five. (Component test.)
- [ ] A closed row names the direction, the other location and the distance, for a two-way Nearby, a one-way and a Far Connection.
- [ ] Opening a row shows Travel, Distance and the hints; an edit there rewrites the record and the closed header follows.
- [ ] Adding a Connection opens its row and leaves the others as they were.
- [ ] Collapse All closes every open row, and opens every row when none is open.
- [ ] A world search for a Travel Hint lands on the Connections tab with the row open and the box focused.
- [ ] The dev router opens the Connections tab by name, and the tour's Connection step points at it.
- [ ] Frames: `.scratch/frames/connections-tab-closed-dark.png`, `-closed-light.png`, `-open-dark.png`, `-open-light.png`, at 1440 wide, on a location with at least five Connections.
- [ ] The Locations wiki page, the changelog fragment and any help topic that says where Connections are edited name the new tab. Help vectors are rebuilt if a topic changed.

For you: open a location with many Connections and say whether the closed list reads well.
