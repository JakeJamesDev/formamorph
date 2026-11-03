# 05: Kept-Protection Check

Status: ready-for-human
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

- [x] Given before and after ledger records, the check reports lost module coverage; tests cover a loss and a no-loss case. `coverageChange` in `keptProtection.test.mjs`, plus a live removal on `saveOrdering.test.ts`: exit 1.
- [x] A deliberately weakened test fails the check on a Q5 module through a surviving mutant. `saveOrdering.ts`: 47 detected to 42, exit 1; restored, exit 0.
- [x] The smoke run's mutant count and duration are recorded, with a projected cost per Q5 module. 78 mutants in 12.6 s; 109 modules in the recipe's table.
- [x] A short recipe in the spec folder says how to prove a Q5 move, another move, and a bug-fix test's removal. [kept-protection.md](../kept-protection.md).

## Landed

[kept-protection.md](../kept-protection.md) holds the recipe and the numbers. [keptProtection.mjs](../../../../scripts/keptProtection.mjs) has the commands, and `testLedger.mjs` gained `--coverage-module`. To check the projection, I ran `AuthService.ts` as well as the approved smoke. It took about 90 s at 4 workers.

**Not verified:**

- The projection is checked against only 2 modules, and both are small. View modules are projected, not measured.
- The Stryker run itself has no unit test, only the live runs. The sandbox link and cleanup are proved by those runs.
- Why static mutants read Survived. The report for `minus` in the rules module shows 34 tests run and passed, although a broken `minus` must fail them. I stopped at the time box, so the recipe names the blind spot and the report counts them.
- Why Windows refused to delete a finished sandbox (both `AuthService.ts` runs). The tool now warns and retries on the next run.
- The Q9 steps in the recipe were not run, since no test was removed for real.

**For you:** nothing.
