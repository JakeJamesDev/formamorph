# 23: Free Links On The Connections Tab

Status: done
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

**The tab's hint:** ticket 22 keeps the old two-sentence hint. Its second sentence says a location still connects to its parent, children and siblings. The group now says that, so cut the hint to its first sentence (Q200).

**Left over from ticket 22:** an undo on the canvas that names a Connection field must not leave a request to open a row behind. The reveal hook drops the request on every move, but no test covers the canvas path. Add one.

**Left over from ticket 21:** the canvas's direction and distance intent helpers have no caller but their own tests since the canvas sends the widget's rewritten record. Delete the two helpers and their tests.

**Left over from ticket 24:** the Design System page does not list the two Known In marks of the Nearby view: the full mark (the entity-location tint and ring) and the lighter mark (a dashed outline). The user picked that look before the landing. Add both to the page's canvas marks.

Spec rulings: Q176, Q182, Q48.

## Acceptance criteria

- [x] A location with a parent, a child and a sibling lists three free links, each with the right relation. (Component test: `lists the parent, a child and a sibling with the relation of each`.)
- [x] The group is closed on open and shows its count. (`starts closed and shows the count`.)
- [x] A pair that has a Connection is not in the group. (`leaves out a pair that has a Connection`.)
- [ ] The button creates a two-way Nearby Connection, opens its row in the list above and removes the free row. One undo step reverses it. (Component test covers the create, the open row and the removed free row, with one `addConnection` call; the undo step is not driven.)
- [x] Deleting that Connection lists the pair as a free link again. (`lists the pair as a free link again when its Connection is deleted`.)
- [x] A top-level location with no children shows no group. (`shows no group for a top-level location with no children`.)
- [x] Frames: `.scratch/frames/connections-free-links-dark.png` and `-light.png`, at 1440 wide, with the group open. (Playwright, 1440x900, 600 ms settle.)
- [x] The Locations wiki page and the changelog fragment describe the group. (`docs/World-Editor-Locations.md` Free Links; `docs-internal/changelog.d/npc-schedules-23.md`.)
- [x] The canvas's direction and distance intent helpers and their tests are gone, and a search finds no caller. (`directionIntent`, `distanceIntent` and the then-unused `directionOf` deleted; grep clean.)
- [x] The Design System page lists the two Known In marks of the Nearby view. (New row in the Bounded Spatial Workspace table.)
- [x] A test undoes a Connection edit made on the canvas, then opens that location's Connections tab, and finds every row closed. It fails when the reveal hook keeps the request. (`useHistoryReveal.test.tsx`, `drops a request nobody took...`: hook-level, with a holder for the row request; failed with the `showConnectionRow?.(null)` line removed.)

For you: read the group's name and its line of text, and say whether an author would understand "free".

## Landed

**Not verified**
- One undo step reverses the free-link button: the component test counts one `addConnection` call, but no test undoes it in the editor.
- The undo test for the canvas path runs at the hook, not through a mounted editor and the Connections tab. The tab-level click path is not driven.

**For you**
- Read the group's name and its line of text, and say whether an author would understand "free". Look at `.scratch/npc-schedules-23/frames/connections-free-links-dark.png` and `-light.png`.
