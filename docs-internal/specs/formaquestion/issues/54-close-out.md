# 54: Close-out

Status: ready-for-agent
Blocked by: 53
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Formaquestion meets its final bar of 75% (Q84), and the effort closes. Three runs held at 74.5–75.5%, so the user set the bar at the measured level.

**1. Fix the `here-make-tool` regression.** In ticket 53, "how do I make a new one here?" on the Tools tab lost **How to Try a Tool** from its block and failed 10 of 10. The only Tools.md change was ticket 52's core-term keyword line, which was not tested alone.

- Confirm the cause by testing that line alone.
- Fix it so the question gets its how-to again, without losing ticket 52's `tools-2` gain. Check the blind set.

**2. Fix two keys (Q84).** Both questions are answered right from a real guide section that their key does not list.

- `memory-2`: add `Memory#turning-memory-off`.
- `world-editor-openings-2`: add `World-Editor-Openings#how-to-add-an-others-opening`.
- Change no other key.
- Rescore tickets 46 and 53's raw answers with the new keys, so every bar number compares.

**3. Final measurement.** Ticket 26's harness, default cloud model, 125 questions, both arms, 5 runs, the new keys. The bar is 75% grounded-correct over the English task, "here" and follow-up questions. A result inside 2 points of the bar gets a second batch before the verdict.

Recommended model rationale: one regression to trace, then the measurement that closes the effort.

## Acceptance criteria

- [ ] The handover names the `here-make-tool` cause, tested alone, and the question gets its how-to again
- [ ] `tools-2` keeps its gain, and blind recall@5 does not drop; same batch
- [ ] The two keys list their extra section, and no other key changed
- [ ] Tickets 46 and 53 are rescored with the new keys
- [ ] The report states pass or fail against the 75% bar
- [ ] Four gates green
