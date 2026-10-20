# 02: You Mark in the Side Panel

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

This ticket puts the You pill on the rest of the side panel: the persona row, the played owner's stat heading, and the **Stats** panel picker. Rulings Q1, Q3. Sonnet, because it reuses 01's component on three known spots.

## What to build

A player looks at the side panel:

- The persona row above **Stats**, **Traits** and **Location** reads their persona's name and the You pill. **None** shows no pill.
- Each played owner's stat section heading carries the pill.
- The **Stats** panel picker marks the persona too. It uses the pill inside the select item if the item and the trigger show it cleanly. If they don't, it keeps its current `(You)` text.

## Acceptance criteria

- [ ] The persona row renders the name plus the shared pill. **None** renders no pill.
- [ ] Each played owner's stat section heading renders the name plus the pill. This includes the Custom Persona entity under None and under a library persona.
- [ ] The **Stats** panel picker either shows the pill in its item and its trigger, or keeps `Kate (You)`. The ticket records which, with a static frame of the open list.
- [ ] When the player changes persona mid-game, the pill moves to the new persona.
- [ ] GamePanels render tests cover the persona row and the stat heading. Removing the pill from either one makes its test fail.
- [ ] Static frames in dark theme, light theme, and mobile (375 px) on the **Status** tab.
- [ ] A changelog fragment. Four gates green, exit codes read.
