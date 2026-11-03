# 02: Play Emberwatch

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a new surface plus a small entry path, with known hold patterns to follow.

**What to build:** when the intro ends, a new player sees Morphie and one step: **Browse Worlds** on the left and **Play Emberwatch** on the right. Play goes straight into the game, skipping the Enter World steps as Quick Start does. Browse Worlds closes the step and stays on the main menu.

- [ ] The step is due only through the rules module, and it never opens for a player who already has the intro-seen record.
- [ ] Play Emberwatch starts the bundled world through a new entry by world id that reuses Quick Start's defaults and ends in the same start-game path. The world's readme still queues in the game (Q21).
- [ ] An event dialog waits behind the step and appears when the player next reaches the main menu (Q22). Tutorial popovers hold too. Removing the hold fails a test.
- [ ] A desktop player with no working AI sees the existing AI gate first.
- [ ] Button order follows Paired Footer Actions, and a rendered test checks the order.
- [ ] The step has a dev route. Frames at `.scratch/frames/first-run-1280.png` and `.scratch/frames/first-run-375.png`, in both themes.
- [ ] A changelog fragment states what changed for the player.

For you: the step's wording, on the first-run dev route, before it ships.
