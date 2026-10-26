# 18: Place Drone Locations

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q25; Implementation Decisions › Canvas layout)

## What to build

**Reincarnated Drone** landed its expansion (ticket 03) before the canvas ruling, so its twelve locations still fall back to the editor's default layout. After this ticket, an author who opens Drone's Locations canvas sees Magiterra Nova laid out as its lore describes it.

- Read the stripped world and each location's text for direction and distance: the capital, the wastes, the frontier line, the peaks, the hill, the camp, the vaults, the Leviathan, the crossroads village, the fort, and the mire. Where the text gives no direction, choose one that the connections and travel hints make coherent, and add the direction to that location's AI text so the map and the words agree.
- Store a `canvasPosition` for every location, by script, within each Group's canvas: north is up, east is right, a far place sits farther than a near one, and no two nodes overlap at the grid size.
- Preserve every other byte of the world file. Regenerate the fingerprints.
- Follow the `bundled-worlds` skill: stripped copies, edits by script, validation before saving.

## Acceptance criteria

- [ ] Every Drone location has a `canvasPosition`, and the stripped diff shows only positions, any direction words added to AI text, and the fingerprints.
- [ ] The layout matches the lore's directions and distances, shown in `.scratch/frames/drone-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme.
- [ ] The shared suite is green, and Drone's probe shows no structural regression at 5 runs per arm if any AI text changed; no probe if only positions changed.

For you: open Drone's Locations canvas and check the map reads the way the world does.
