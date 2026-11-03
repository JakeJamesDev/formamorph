# 01: Demo AI Entry Line

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a new rules seam every later ticket builds on, and a turn-count signal in GameViewer that a regenerate must not trip.

**What to build:** a player on the Demo AI enters a game with no dialog. A short line in the narration area says they're on the Demo AI, and the badge still opens the longer explanation. Behind this sits the one rules module the effort uses, the per-device records, and a Demo AI turn count that rises on each new committed turn.

This ticket owns the rules module and the device records. Later tickets add no second copy of either.

- [ ] One pure module answers, from plain facts: is the first-run step due, is the card due, does the entry line show, does AI setup lead with Formamorph AI. GameViewer and MainMenu only pass facts in.
- [ ] Table tests cover every due and never-due case in the spec, including the fifth turn and not the fourth, a pledged player, a non-Demo endpoint, a build without hosted AI, 8,500 MB against 8,501 MB, and unknown VRAM.
- [ ] The count rises on a new committed turn while the Demo AI writes the narration, in any world. A regenerate does not count. Removing that guard fails a test.
- [ ] A player whose existing Demo AI seen key is set starts at zero (Q13).
- [ ] The Demo AI dialog leaves the entry order. The order is the AI gate, then the readme, and `entryDialogOrder.test.ts` says so.
- [ ] The entry line needs no dismissal and never blocks input, in the Chat and Pages layouts, read from the DOM on a dev route.
- [ ] The badge still opens the longer dialog.
- [ ] A changelog fragment states what changed for the player, and the docs that mention the entry dialog are current.

For you: the entry line's wording, in the game view on the Demo AI, before it ships.
