# 07: Seed Rule

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Every reader opens a stat at the authored value, as play does. Ruling Q8.

## What to build

An author types a stat's value and sees that number at turn one in play, in Test Code, in the Bench and in the Enter World trait picker's gate preview. `starting` is the delta baseline, never the opening number. Today the Bench's turn-one seeding and the gate-stat start value read `starting` first.

## Acceptance criteria

- [ ] The gate-stat start value reads the authored value, then min, then zero, matching play's seeding. The two seeding rules are one function or one documented rule.
- [ ] The Bench's turn-one seeding adopts the same rule (until 06 replaces it with the opening fold).
- [ ] A bite test: a stat with `starting` 10 and value 5 reads 5 at turn one in the Bench and in Test Code, and the gate-stat start value is 5. The test fails against today's Bench seeding and gate-stat value.
- [ ] Existing gate, trait picker and Bench tests stay green. An assertion changes only where this ruling changed the result, and names Q8.
- [ ] A changelog fragment with one Fixed lead for authors: a stat opens at its authored value in the Test Bench, Test Code and the trait picker, as it does in play.
- [ ] Four gates green, exit codes read.
