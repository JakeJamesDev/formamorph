# 02: Hero Turn Capture

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Owns the hero turn's data file, the frames and the layout data that tickets 03 and 04 read.

## What to build

The site screenshot script captures the hero turn. It loads an Emberwatch game at the Cinder and Crown with Wenna Tallow present and the player carrying a few items. For light and dark in the purple palette, it writes:
- the Stats tab with the turn's text, choices, stat values, fills and descriptors hidden;
- the Inventory tab before the Beer-Stained Barrow Map arrives;
- the Inventory tab after it arrives;
- the full Inventory frame for the tour.

It also writes the layout data file the page loads as a script: the boxes of each piece of text, each stat row, the side panel and the new item row, and each mode's colors.

The turn text lives in one data file the capture loads into the game and the page plays. The prototype's capture (`.scratch/landing-v2/capture-ember.mjs`, untracked) works and holds the fixes listed in the spec's capture decisions: Item Copies on the player, an empty global stat list, a fresh browser context per state, empty AI replies in place of a refusal, and the folded Inventory tab clicked by position.

## Acceptance criteria

- [ ] One run of the capture for this scene writes the four frames per mode and the layout data file into the site's shots, beside the existing gallery shots; the existing screens are not retaken.
- [ ] The shared demo-game helper places Item Copies, and the existing gameplay capture still verifies with its verify-only run.
- [ ] The capture rejects a frame when the turn text, the three choices or the new item row is missing or clipped, the way the gameplay capture rejects a clipped scene.
- [ ] No endpoint error dialog appears in any frame: the four frames per mode are stored as `.scratch/frames/turn-<mode>-<frame>.png`.
- [ ] The layout data file loads as a plain script with no fetch, and its boxes match the frames (spot-checked against the full Inventory frame).
- [ ] The script's header comment documents the new scene and its outputs.

For you: the turn text itself, read in the full Inventory frame, before it ships.
