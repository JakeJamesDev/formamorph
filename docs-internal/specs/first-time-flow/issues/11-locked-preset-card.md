# 11: Locked Preset Card

Status: ready-for-agent
Blocked by: 04, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one surface change that reuses the scene's level table, its fire and the checklist.

**What to build:** a player who selects Formamorph AI in AI settings with no access sees a panel with Morphie, the fire and the three levels, in place of the plain text and button. Picking a level changes the fire and Morphie's look. **See Levels** opens the full scene, and **Support on Patreon** opens the checklist. The panel shows for a signed-out player, a player without the 18+ check, and a signed-in player with no pledge.

- [ ] The panel replaces the reason text and button for those three cases, and the checklist starts at the first step that player hasn't finished (Q28).
- [ ] Every other preset state keeps today's text and actions: ready, warned, exhausted, paused, and any update or privacy prompt. A rendered test covers each state.
- [ ] The panel reuses the scene's level table and fire, with no second copy. A level change plays the Jelly on Morphie only.
- [ ] The panel opens nothing by itself. Selecting the preset never opens the scene (Q27).
- [ ] A player who gains access while the panel shows sees the normal preset state after the existing re-read.
- [ ] The panel fits the AI settings pane at desktop and mobile widths, and it reads well in both themes although the scene is always dark. Frames at `.scratch/frames/locked-preset-1280.png` and `.scratch/frames/locked-preset-375.png`, in both themes.
- [ ] `docs/` pages that describe the locked preset are current, and a changelog fragment states what changed for the player.

For you: the panel's wording, in AI settings on its dev route.
