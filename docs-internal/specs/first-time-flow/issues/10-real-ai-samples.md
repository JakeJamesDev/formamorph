# 10: Real AI Samples

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: judgment work on honest sample picks and on what each context window really keeps.

**What to build:** the scene's side-by-side block shows real, unedited output from the Demo AI and Formamorph AI for one Emberwatch moment, from the same prompt. Each level's line and lit-moment count match what that level's context window really keeps on a typical world, so the road doesn't overstate the difference.

- [ ] Several runs per arm on both AIs, from the same state and prompt, captured to `.scratch/`. Spend on the hosted provider stays small, and the session reports it in chat only.
- [ ] The shipped pair is typical output, never the Demo AI's worst. The session offers the user at least two candidate pairs.
- [ ] Each level's line and lit count come from a measured read of how many turns each window keeps verbatim on Emberwatch and a heavier bundled world. The measurement goes in the ticket as turn counts per window, with no costs or budgets.
- [ ] No provider name, cost or budget appears in any tracked file.
- [ ] Frame at `.scratch/frames/road-samples-1280.png`.

For you: pick the sample pair and approve the level lines, on the scene's dev route.
