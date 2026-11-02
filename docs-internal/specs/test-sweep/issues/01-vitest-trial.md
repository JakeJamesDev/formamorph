# 01: Vitest Trial

Status: ready-for-human
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

- [x] A note records both toolchains' times, the load conditions, and the migration cost.
- [x] The note states whether `recordDependencies` changed the selected tests on at least three real change sets.
- [x] The note recommends adopt or stay, and the owner's decision is recorded in it.
- [x] If adopted, the app and site production builds were compared against the current output.

For you: Adopt or stay: read the note's recommendation.

## Landed

The owner chose adopt. Vitest 5.0.5, Vite 8.3.5 and plugin-react 6.1.2 replace the old toolchain, with `vite-node` and `esbuild` added as direct dependencies. Results are in [vitest-trial.md](../vitest-trial.md).

**Not verified**

- Android: no device run.
- Electron: the shell ran on the app build, but no packaged installer ran.
- Cloudflare dashboard build settings are not in the repo. Their Node version must be 22.12+ or 24.
- `npm run test:e2e` loads 0 tests at Base, so only nine specs ran, with the same 25 failures on both arms.
- Vitest 5's module cache shared across worktrees.

**For you**

- Adopt or stay: read the note's recommendation.
