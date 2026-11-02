# 06: Allowance Ring and Popover

Status: ready-for-human
Blocked by: 02, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a new visual pattern, routing rules and turn-timing state in the game's busiest row.

**What to build:** while Formamorph AI serves any prompt, a ring between Help and Send fills as the week's allowance is spent. Selecting it opens a popover with the usage lines and breakdown, or the state's reason and actions.

- [x] Before building, show the ring's look in a mock and get the user's approval. It then enters the Design System and its showcase. The user approved matching outlines with Help 20px, ring 24px, Send 20px; the showcase reference renders, read with Playwright, and `AllowanceRingReference.test.tsx` covers it.
- [x] The ring shows for a narration prompt on Formamorph AI and for one pinned prompt, and not when no prompt uses it. Test through the GamePanels harness. `GamePanels.allowanceRing.test.tsx`, "when it shows".
- [x] A player with no Formamorph AI prompt makes no new server read. "stays away, and reads nothing".
- [x] The figure holds during a turn and moves when the turn ends, committed or aborted. Test covers both. "moves when the turn commits" and "when the turn is stopped", plus the remount case; the guards failed with the hold removed.
- [x] The ring changes color at each value in `warnThresholds`. "color" cases on both sides of 75 and 90. A list of three or more values changes color twice, per the spec session's ruling.
- [x] It is a button whose accessible name holds the percent, and it works from the keyboard. "opens from the keyboard" and the accessible-name assertions.
- [x] The popover refetches the hosted state on open and shows percent used, about how many turns are left, the reset day and the breakdown. "reads the state on open".
- [x] Paused, locked and the app-derived states show no fill and the existing reason and actions. At the end of the allowance it holds switch back and the Patreon link. "the popover" cases per state; dev-route DOM reads.
- [x] The dev router reaches each state. Frames at `.scratch/frames/06-ring-<state>-1440-dark.png` for ready, warned, exhausted, paused and locked, plus `.scratch/frames/06-ring-ready-1440-light.png`. `allowance=<state>` route; all frames stored.
- [x] A changelog fragment covers the ring, and the help topic for playing the game mentions it. `weekly-allowance-06.md`, the `game.howToPlay` Actions tab.

## Landed

**Not verified**

- Nothing unticked. No live turn ran against the real server; the hold was tested through the harness.

**For you**

- Judge whether the ring draws the eye too much at each warning color, in a game with Formamorph AI active. Look at `.scratch/weekly-allowance-06/frames/06-ring-warned-1440-dark.png` and `.scratch/weekly-allowance-06/frames/06-ring-warned-high-1440-dark.png`.
- A breakdown's nested row can disagree with its group: **Stat Updates** shows 17% under a group at 16% in the warned frame. It comes from ticket 05's rounding.
- At 89.6% the ring reads 90% used in amber, because the color uses the exact figure and the label rounds.
