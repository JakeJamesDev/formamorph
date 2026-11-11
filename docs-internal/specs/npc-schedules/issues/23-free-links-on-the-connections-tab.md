# 23: Free Links On The Connections Tab

Status: ready-for-agent
Blocked by: 22
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A location can always travel to and from its parent, its children and its siblings without a Connection. The editor only says so in a hint line. Show these free links on the Connections tab, and let the author turn one into a Connection.

- One folded group under the Connections and the picker, closed by default. Its header gives the count.
- Open, it lists each free link: the two-way icon, the other location's name, and what it is to this one (the location it is in, a location inside it, or a location beside it).
- It lists only the pairs no Connection covers. A pair with a Connection is in the list above, not here.
- Each row has one button that makes it a Connection: two-way and Nearby. The new Connection joins the list above with its row open, and the free row goes.
- Deleting that Connection brings the free row back.
- A location with no free links shows no group.
- One line in the open group says that travel works both ways with no Connection and that each is Nearby. Write it under the Writing Guide.

The free links come from the location graph's implicit neighbors. Use them; do not compute the tree a second time.

The prototype shows the group: branch `prototype/connection-rows`, variant B4, under the picker. "Free Links" is a working name; final copy follows the Writing Guide.

**Left over from ticket 21:** the canvas's direction and distance intent helpers have no caller but their own tests since the canvas sends the widget's rewritten record. Delete the two helpers and their tests. If ticket 24 is still in progress, ask its session first: it edits the same test file.

Spec rulings: Q176, Q182, Q48.

## Acceptance criteria

- [ ] A location with a parent, a child and a sibling lists three free links, each with the right relation. (Component test.)
- [ ] The group is closed on open and shows its count.
- [ ] A pair that has a Connection is not in the group.
- [ ] The button creates a two-way Nearby Connection, opens its row in the list above and removes the free row. One undo step reverses it.
- [ ] Deleting that Connection lists the pair as a free link again.
- [ ] A top-level location with no children shows no group.
- [ ] Frames: `.scratch/frames/connections-free-links-dark.png` and `-light.png`, at 1440 wide, with the group open.
- [ ] The Locations wiki page and the changelog fragment describe the group.
- [ ] The canvas's direction and distance intent helpers and their tests are gone, and a search finds no caller.

For you: read the group's name and its line of text, and say whether an author would understand "free".
