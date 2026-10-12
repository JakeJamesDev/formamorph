# 01: Characterization Tests For The Hand-Built Requests

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: four pure tests that call existing builders and pass records with shared inputs; no design, no view code.

## What to build

A test file that proves the four hand-built request builders in the game view and their pass-record twins produce the same request from the same inputs, byte for byte, before any builder is deleted:

- the memory digest drainer's request against the summary pass;
- the character diary drainer's request against the diary pass;
- the choices re-roll against the choices pass;
- the stats re-roll against the stat-updates pass.

Each comparison covers the system prompt, the messages, the request type, the token cap, `silent`, `quiet` and the attach turn id. Where the two differ on purpose, the test states the difference and asserts it: the pass record adds Request Anatomy; the diary's entity text (empty for an unknown name today); the pass record's base context in place of the view's context values; the effective action in place of the raw paired user message.

The builders live inside the view today, so the test extracts their bodies into pure functions beside the view only as far as needed to call them; it changes no behavior. Tickets 04 and 05 delete the builders and these tests with them.

No changelog entry.

## Acceptance criteria

- [ ] Four comparisons run as plain tests with no component mount.
- [ ] Each comparison is byte-equal on every field except the stated differences, and each stated difference is asserted.
- [ ] Reinstating a drift (for example a changed cap or a swapped prompt key in one builder) turns the matching test red.
- [ ] Four gates green.
