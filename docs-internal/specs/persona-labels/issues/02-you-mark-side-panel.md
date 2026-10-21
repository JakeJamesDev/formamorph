# 02: You Mark in the Side Panel

Status: done
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

## Outcome

- **Picker: the pill.** The Stats panel picker renders the pill inside the select item, and Radix copies the item's content into the closed trigger, so both show `Sable [You]`. The `(You)` text is gone. Frame of the open list: `.scratch/you-mark-02/1-dark-picker-open.jpg` (gitignored, in the ticket worktree).
- **Alignment read from the DOM:** on the persona row, the trigger and the stat heading, the pill is 14 px tall and its center matches the name's line center to the pixel.
- **Dev fixture:** `entityStats` now plays Sable, a world persona with one stat, so the three spots render on one route (`#dev?view=gameViewer&fixture=entityStats`).
- **Accessible names:** the played owner's heading reads "Sable You". The `aria-label` of its section stays `Sable stats`.
