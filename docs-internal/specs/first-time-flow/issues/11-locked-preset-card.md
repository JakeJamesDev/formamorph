# 11: Locked Preset Card

Status: done
Blocked by: 04, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one surface change that reuses the scene's level table, its fire and the checklist.

**What to build:** a player who selects Formamorph AI in AI settings with no access sees a panel with Morphie, the fire and the three levels, in place of the plain text and button. Picking a level changes the fire and Morphie's look. **See Levels** opens the full scene, and **Support on Patreon** opens the checklist. The panel shows for a signed-out player, a player without the 18+ check, and a signed-in player with no pledge.

- [x] The panel replaces the reason text and button for those three cases, and the checklist starts at the first step that player hasn't finished (Q28). Test `draws the levels panel for %s`; the panel keeps the state's reason line above the stage. The checklist is the existing one, which reads real state.
- [x] Every other preset state keeps today's text and actions: ready, warned, exhausted, paused, and any update or privacy prompt. A rendered test covers each state. Test `keeps the reason text and actions for %s`, nine states.
- [x] The panel reuses the scene's level table and fire, with no second copy. A level change plays the Jelly on Morphie only. Test `plays the Jelly on Morphie only and swaps the fire at the dip`.
- [x] The panel opens nothing by itself. Selecting the preset never opens the scene (Q27). Test `opens nothing by itself`.
- [x] A player who gains access while the panel shows sees the normal preset state after the existing re-read. Test `shows the normal state once the player gains access`; the re-read effect is unchanged.
- [x] The panel fits the AI settings pane at desktop and mobile widths, and it reads well in both themes although the scene is always dark. Frames at `.scratch/frames/locked-preset-1280.png` and `.scratch/frames/locked-preset-375.png`, in both themes. Four frames, stored as `.jpg`: the browser pane gives no `.png`.
- [x] `docs/` pages that describe the locked preset are current, and a changelog fragment states what changed for the player. `docs/Connect-Your-Own-AI.md`; fragment `first-time-flow-11-locked-preset-card.md`.

For you: the panel's wording, in AI settings on its dev route.

## Landed

**Not verified**
- The Jelly's frame-by-frame motion: the test checks only that Morphie alone carries a transform and the fire swaps at the dip. Playwright sampling was not run.
- The panel's `lockedPanel` prop is on in `TextEndpointEditor` only. The in-game allowance popover keeps its plain text on purpose.

**For you**
- The panel's wording, in AI settings on its dev route: `#dev?view=mainMenu&modal=settings&tab=endpoints&subtab=text&fixture=fai-locked`.
- The panel shows the state's existing reason line above the stage and the level table's line below the picker. Ticket 14 rewrites that table (Q55).
- Frames: `.scratch/first-time-flow-11/frames/locked-preset-1280-dark.jpg`, `locked-preset-1280-light.jpg`, `locked-preset-375-dark.jpg`, `locked-preset-375-light.jpg`.
