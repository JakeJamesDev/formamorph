# 03: Change Dots

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rulings: Q8, Q13, and the spec's calls on when a dot appears and how long it lasts. Workload: change detection over runtime state from turns, scripts and panel writes.

## What to build

While the right side is collapsed, a change to the player's stats, traits or inventory puts a dot on that rail icon. The change can come from a turn, a script or a panel write. The dot stays until the player opens that tab in the drawer or docks the panel on it. Opening a tab clears only its own dot. A change while the panel is docked adds no dot. Location and the left rail get no dots. Dots live for the game session only.

Detection reads runtime state and never writes GameDataContext.

## Acceptance criteria

- [x] A turn that changes a stat while the right side is collapsed adds a dot to Stats. The same holds for a trait and for an inventory change, each on its own icon. (`GameViewer.changeDots.test.tsx`: the three "marks …" cases.)
- [x] Opening the tab in the drawer clears its dot and leaves the others. ("clears only the dot of the tab the drawer opens", plus the drawer tab strip and docking cases.)
- [x] A change while the right panel is docked adds no dot after collapsing. ("adds none for a change made while the panel is docked".)
- [x] No dot appears on Location or on any left rail icon. ("marks Stats …" reads both rails after the turn.)
- [x] The dot has an accessible name a screen reader announces with its icon. (Every case reads the icon names, for example "Stats, changed".)
- [x] Tests drive the change through a turn on the mocked endpoint, never by setting a dot directly. (Stat tracker, inventory keeper and an After the AI script on the stubbed endpoint.)

## Landed

**Not verified**

- The persona's own traits (the played entity's owned traits) are in the Traits signature, but no test switches one.
- The DEV fixture load (`fixture=` on the dev route) does not rebase the dots. It runs before the dot hook is declared, and it is dev only.
- Look and placement of the dot (T03-6) were not checked in the browser. A dot needs a turn on a live endpoint.

**For you**

- Collapse the right side, play a turn that changes a stat or gives an item, and check the dot on the icon's top right, in both themes.
