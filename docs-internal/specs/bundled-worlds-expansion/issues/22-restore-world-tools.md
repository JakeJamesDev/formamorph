# 22: Restore World Tools

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q7, Q9; Implementation Decisions › Tools on the cloud model)

## What to build

Rampage and Emberwatch landed without their World Tools because the cloud model spilled native reasoning when a judgment Tool was offered on narration, and the stat pass could not call a Tool under its schema. The app-side fix is on main now: the model's thought channel is handled as reasoning, and the stat pass can call Tools under its schema. After this ticket, a Rampage player sees `log_landmark` record the landmarks the creature destroys, and an Emberwatch player sees `offer_prayer` move Faith at the chapel.

- Lift each Tool from its content ticket's comments: `log_landmark` from ticket 05 (On Call, pins a memory and adds 5 Destruction once per landmark, the enum of landmark names) and `offer_prayer` from ticket 04 (On Call, guarded to the Chapel of the Ember once per story day, +10 Faith and one memory line). Offer each where it calls reliably now: the stat pass first, since the narration exists there and the call is a fact, with narration as the fallback if the stat pass still declines.
- Replay the cases each ticket recorded, with the Tool-spill probe harness that the fix added: a vague opening and a real trigger, 6 to 10 each per prompt. Pass when the Tool calls on the real trigger, stays quiet on the vague opening, spills on neither, and the stat reply stays valid.
- Then the world probe at the Q9 bar for each world, with Tools offered.
- Move `tools` from planned into each world's row. Each world still plays with Tools off (ADR-0013). Scripts follow the house style.

## Acceptance criteria

- [ ] Rampage and Emberwatch each ship their Tool, and the shared suite shows `tools` in both rows with the set check green.
- [ ] Replay numbers per Tool and prompt are in this ticket's comments: calls on the trigger, calls on the vague opening, spills, valid stat replies.
- [ ] The world probe shows no structural regression and a win or tie for each world at 5 or more runs per arm, numbers in the comments.
- [ ] Per-world tests cover each Tool handler's write and are shown to bite.
- [ ] Fingerprints are regenerated. No changelog fragment.

For you: in play on the cloud model, destroy a named landmark in Rampage and pray at the chapel in Emberwatch, and check the memory line appears.
