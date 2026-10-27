# 18: Place Drone Locations

Status: done
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

- [x] Every Drone location has a `canvasPosition`, and the stripped diff shows only positions, any direction words added to AI text, and the fingerprints. 12 of 12; `buildLocationCanvas` check: all on the 20 px grid, no sibling overlap; diff at `.scratch/bundled-worlds-expansion-18/frames/drone-stripped.diff`.
- [x] The layout matches the lore's directions and distances, shown in `.scratch/frames/drone-canvas.png` for the root Group and one frame per child Group, 1280 wide, light theme. Frames at `.scratch/bundled-worlds-expansion-18/frames/drone-canvas*.png`, Playwright at 1280 × 900.
- [x] The shared suite is green, and Drone's probe shows no structural regression at 5 runs per arm if any AI text changed; no probe if only positions changed. Probe below; suite green in prepare's full gate run, which refuses to land on red.

## Landed

**Not verified**

- None.

**For you**

- For you: open Drone's Locations canvas and check the map reads the way the world does.
- Check the root frame reads as the rulings: the capital east, the Wastes far west, Thornmere and Mossback Hill between, the Frontier south. `.scratch/bundled-worlds-expansion-18/frames/drone-canvas.png` and the three Group frames beside it.

## Comments

**Rulings (spec session).** Q1: the proposed compass. Q2: a relational phrase counts when it anchors the place to one already placed. Q3: the structural bar only; score the rubric and report it.

**What changed.**

- **Positions.** Root: the Scavenger Wastes far west, Mossback Hill and Thornmere in the middle, the Ashfall Capital east, the Demon Frontier south with its west edge near the Wastes. Wastes: Hulkfall Camp on the east edge, the Leviathan deep west. Frontier: Fort Graywatch, the Blight Line, then the Peaks, north to south. Capital: the Vaults alone.
- **Thornmere sits just south of the trade road.** On the road itself, the capital–Wastes arrows covered its box.
- **Compass sentences, seven.** Magiterra Nova, Ashfall Capital, Scavenger Wastes, Demon Frontier, Mossback Hill ("north of Thornmere", not "just": the road runs between them), Hulkfall Camp, Blightcrown Peaks. The Peaks keep "above the Demon Frontier": it is height, not compass.

**Probe (Q3).** Cloud `default`, Drone, worktree vs `bbfb6194b`, 5 runs per arm, interleaved. Summary at `.scratch/bundled-worlds-expansion-18/frames/drone-probe-summary.md`.

| Arm | Turns | Empty | Leaks | Placeholders | Choices ok | Stat ok | Flagged |
|---|---|---|---|---|---|---|---|
| worktree | 15 | 0 | 0 | 0 | 15/15 | 15/15 | 1 |
| bbfb6194b | 15 | 0 | 0 | 0 | 15/15 | 15/15 | 0 |

- The one flag is DRONE-SPEAKS on an NPC line after "what you hope", the ticket 03 regex false positive.
- Rubric, blind: worktree 23 / 25, `bbfb6194b` 22 / 25. No transcript states a compass direction.

**Probe harness finding.** The first batch failed 8 of 10 runs, in both arms, on the `Enter World` click. `appDriver.mjs` waits 5 s for the "Keep as-is" image dialog. The 40 MB Drone file often takes longer, so the dialog arrives late and covers the button. The batch above ran an untracked copy with a 60 s wait. The tracked harness is unchanged.
