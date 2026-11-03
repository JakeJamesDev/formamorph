# 02: Play Emberwatch

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a new surface plus a small entry path, with known hold patterns to follow.

**What to build:** when the intro ends, a new player sees Morphie and one step: **Browse Worlds** on the left and **Play Emberwatch** on the right. Play goes straight into the game, skipping the Enter World steps as Quick Start does. Browse Worlds closes the step and stays on the main menu.

- [x] The step is due only through the rules module, and it never opens for a player who already has the intro-seen record. (`firstRunStepDue`; tests "never opens for a device that had the intro-seen record at launch", "does not open again once it has been seen")
- [x] Play Emberwatch starts the bundled world through a new entry by world id that reuses Quick Start's defaults and ends in the same start-game path. (`quickStartWorld` calls `quickStart`; test "starts Emberwatch past the Enter World steps"; the readme queue is the game's existing one, not retested here.)
- [x] An event dialog waits behind the step and appears when the player next reaches the main menu (Q22). Tutorial popovers hold too. Removing the hold fails a test. (Tests "holds an event dialog until the step closes" and "starts the main menu tutorial only after the step closes"; each fails with its hold removed.)
- [ ] A desktop player with no working AI sees the existing AI gate first. (Not tested; see Landed.)
- [x] Button order follows Paired Footer Actions, and a rendered test checks the order. (Test "offers Browse Worlds on the left and Play Emberwatch on the right, in that DOM order"; frame at 375 shows Play on top.)
- [x] The step has a dev route. Frames at `.scratch/frames/first-run-1280.png` and `.scratch/frames/first-run-375.png`, in both themes. (`#dev?view=mainMenu&modal=firstRun`; the frames carry a theme suffix, such as `first-run-1280-light.png`.)
- [x] A changelog fragment states what changed for the player. (`docs-internal/changelog.d/play-emberwatch.md`)

For you: the step's wording, on the first-run dev route, before it ships.

## Landed

**Not verified**
- A desktop player with no working AI sees the AI gate first. `aiGatePending` holds the step while the engine state is unknown or the nudge is unseen. No test: it needs a local engine in jsdom. Read from the code only.
- The readme still queues in the game (Q21). The game's existing readme path is untouched. No new test.
- Motion and the step's fade were not sampled. The frames are static.

**For you**
- The step's wording (title, description, the no-Emberwatch line), on `#dev?view=mainMenu&modal=firstRun`.
- Frames: `.scratch/first-time-flow-02/frames/first-run-1280-light.png`, `first-run-1280-dark.png`, `first-run-375-light.png`, `first-run-375-dark.png`.
- The step also waits behind the age gate, so the two never stack. The ticket did not say so; the review raised it.
