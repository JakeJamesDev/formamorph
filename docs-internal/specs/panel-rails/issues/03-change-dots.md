# 03: Change Dots

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rulings: Q8, Q13, and the spec's calls on when a dot appears and how long it lasts. Workload: change detection over runtime state from turns, scripts and panel writes.

## What to build

While the right side is collapsed, a change to the player's stats, traits or inventory puts a dot on that rail icon. The change can come from a turn, a script or a panel write. The dot stays until the player opens that tab in the drawer or docks the panel on it. Opening a tab clears only its own dot. A change while the panel is docked adds no dot. Location and the left rail get no dots. Dots live for the game session only.

Detection reads runtime state and never writes GameDataContext.

## Acceptance criteria

- [ ] A turn that changes a stat while the right side is collapsed adds a dot to Stats. The same holds for a trait and for an inventory change, each on its own icon.
- [ ] Opening the tab in the drawer clears its dot and leaves the others.
- [ ] A change while the right panel is docked adds no dot after collapsing.
- [ ] No dot appears on Location or on any left rail icon.
- [ ] The dot has an accessible name a screen reader announces with its icon.
- [ ] Tests drive the change through a turn on the mocked endpoint, never by setting a dot directly.
