# 19: Growth Rule And Final Replay

Status: ready-for-agent
Blocked by: 16, 17, 18
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: A small tooling change and a measurement; the rule text needs care to stay short and usable.

Parent: [Test Sweep spec](../spec.md)

## What to build

The suite stays lean after the sweep (Q16). `test-bar` gains a level and risk bar, from what the sweep learned. The slow-test reporter warns on slow new tests and never fails a gate. `test-bar` lives in the user's global skills folder, outside the repo, so the ticket hands the proposed text to the spec session and the owner approves it.

Then the harness and a full-suite measurement rerun on the final tree, under the owner's AFK signal, and the result is compared with the Q3 targets for close-spec.

Rulings: Q3, Q6, Q12, Q16.

## Acceptance criteria

- [ ] A slow new test produces a warning naming it, and the gate still passes; a test proves it.
- [ ] The proposed `test-bar` text is in the ticket.
- [ ] A final summary compares full-suite time, gate time, misses and precision with the Reference Run and the Q3 targets.

For you: Approve the `test-bar` text; judge the final numbers against your targets.
