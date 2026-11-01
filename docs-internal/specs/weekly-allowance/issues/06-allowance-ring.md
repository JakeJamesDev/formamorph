# 06: Allowance Ring and Popover

Status: ready-for-agent
Blocked by: 02, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a new visual pattern, routing rules and turn-timing state in the game's busiest row.

**What to build:** while Formamorph AI serves any prompt, a ring between Help and Send fills as the week's allowance is spent. Selecting it opens a popover with the usage lines and breakdown, or the state's reason and actions.

- [ ] Before building, show the ring's look in a mock and get the user's approval. It then enters the Design System and its showcase.
- [ ] The ring shows for a narration prompt on Formamorph AI and for one pinned prompt, and not when no prompt uses it. Test through the GamePanels harness.
- [ ] A player with no Formamorph AI prompt makes no new server read.
- [ ] The figure holds during a turn and moves when the turn ends, committed or aborted. Test covers both.
- [ ] The ring changes color at each value in `warnThresholds`.
- [ ] It is a button whose accessible name holds the percent, and it works from the keyboard.
- [ ] The popover refetches the hosted state on open and shows percent used, about how many turns are left, the reset day and the breakdown.
- [ ] Paused, locked and the app-derived states show no fill and the existing reason and actions. At the end of the allowance it holds switch back and the Patreon link.
- [ ] The dev router reaches each state. Frames at `.scratch/frames/06-ring-<state>-1440-dark.png` for ready, warned, exhausted, paused and locked, plus `.scratch/frames/06-ring-ready-1440-light.png`.
- [ ] A changelog fragment covers the ring, and the help topic for playing the game mentions it.

For you: judge whether the ring draws the eye too much at each warning color, in a game with Formamorph AI active.
