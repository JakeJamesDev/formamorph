# 05: Kept-Protection Check

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Every move and deletion depends on this proof recipe, and Stryker on this stack is unproven.

Parent: [Test Sweep spec](../spec.md)

## What to build

One recipe proves that a moved, merged or deleted test lost nothing (Q8, Q9, Q23). It compares ledger records before and after a change and reports what coverage of the module under test changed. It also sets up Stryker for a chosen module: forks pool, incremental mode, scanner tests excluded, and a smoke run on one small Q5 module. The Q5 result records real mutant counts and time, replacing the unverified 9-hour estimate.

This ticket owns the recipe and its helpers. Tickets 6 to 18 use them and do not build their own.

Rulings: Q5, Q6, Q8, Q9, Q23.

## Acceptance criteria

- [ ] Given before and after ledger records, the check reports lost module coverage; tests cover a loss and a no-loss case.
- [ ] A deliberately weakened test fails the check on a Q5 module through a surviving mutant.
- [ ] The smoke run's mutant count and duration are recorded, with a projected cost per Q5 module.
- [ ] A short recipe in the spec folder says how to prove a Q5 move, another move, and a bug-fix test's removal.
