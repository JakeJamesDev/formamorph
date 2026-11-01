# 01: Vitest Trial

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: A major toolchain trial with an unverified benefit; it needs careful measurement and a clear recommendation.

Parent: [Test Sweep spec](../spec.md)

## What to build

A time-boxed trial answers whether Vitest 5 with Vite 6.4 or later helps this suite (Q24). The ticket measures full-suite and affected-gate time against the current toolchain under comparable load, tries `recordDependencies` on selection, and lists the migration cost, including the production build. Installed is Vitest 3.2.6 on Vite 5.4.0. The trial runs its full-suite comparison only after the owner says they are AFK (Q6).

If the benefit is measured and the owner says yes, the upgrade lands in this ticket. Otherwise only the result lands, in a short note in the spec folder.

Rulings: Q6, Q24.

## Acceptance criteria

- [ ] A note records both toolchains' times, the load conditions, and the migration cost.
- [ ] The note states whether `recordDependencies` changed the selected tests on at least three real change sets.
- [ ] The note recommends adopt or stay, and the owner's decision is recorded in it.
- [ ] If adopted, the app and site production builds were compared against the current output.

For you: Adopt or stay: read the note's recommendation.
