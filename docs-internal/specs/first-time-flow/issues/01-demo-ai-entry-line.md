# 01: Demo AI Entry Line

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a new rules seam every later ticket builds on, and a turn-count signal in GameViewer that a regenerate must not trip.

**What to build:** a player on the Demo AI enters a game with no dialog. A short line in the narration area says they're on the Demo AI, and the badge still opens the longer explanation. Behind this sits the one rules module the effort uses, the per-device records, and a Demo AI turn count that rises on each new committed turn.

This ticket owns the rules module and the device records. Later tickets add no second copy of either.

- [x] One pure module answers, from plain facts: is the first-run step due, is the card due, does the entry line show, does AI setup lead with Formamorph AI. GameViewer and MainMenu only pass facts in. `src/lib/firstTimeFlow.ts`; MainMenu has no caller until ticket 02.
- [x] Table tests cover every due and never-due case in the spec, including the fifth turn and not the fourth, a pledged player, a non-Demo endpoint, a build without hosted AI, 8,500 MB against 8,501 MB, and unknown VRAM. `firstTimeFlow.test.ts`.
- [x] The count rises on a new committed turn while the Demo AI writes the narration, in any world. A regenerate does not count. Removing that guard fails a test. `GameViewer.demoAITurnCount.test.tsx`; with `isNewTurn: true`, the regenerate test fails, expected 2 to be 1.
- [x] A player whose existing Demo AI seen key is set starts at zero (Q13). The same file and `firstTimeFlowStore.test.ts`.
- [x] The Demo AI dialog leaves the entry order. The order is the AI gate, then the readme, and `entryDialogOrder.test.ts` says so.
- [x] The entry line needs no dismissal and never blocks input, in the Chat and Pages layouts, read from the DOM on a dev route. `#dev?view=gameViewer&fixture=whiteRoom&mode=pages` and `mode=chat` at 1280: no dialog, input enabled, focus on the body, text clear of the badge. Pages at 375 also clears the badge.
- [x] The badge still opens the longer dialog. `DemoAINotice.test.tsx`, and a DOM read at 375.
- [x] A changelog fragment states what changed for the player, and the docs that mention the entry dialog are current. `How-to-Play.md` and `Starting-a-Game.md`.

## Landed

**Not verified:** nothing from the list above. A loaded save has no test of its own: loading commits no turn, so the count code doesn't run.

**For you:**

- The entry line's wording, in the game view on the Demo AI, before it ships: "You're on the Demo AI, a small free model. Select its badge to learn more." See it at `#dev?view=gameViewer&fixture=whiteRoom` after you clear `FORMAMORPH_demoAIDialogSeen`.
