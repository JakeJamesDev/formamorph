# 02: Daily Ceiling Holds for Started Turns

Status: done
Base: 9144ab5
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q2, Q24, Q29)

Model rationale: a transaction subtlety, because the pause must survive a refusal that keeps no row.

**What to build:** a paused day stops started turns too. Each turn gets one grace call at or after the pause began, and later calls get `service_paused`. A first call whose reservation would reach the ceiling starts the pause and is refused. A continuation that reaches the ceiling starts the pause and uses its grace call. An admin lift still restores service.

- [x] A turn's second call on a paused day is refused with `service_paused`, and its first call after the pause is admitted. Spend suite, "a turn that runs into the pause"; limits suite for a pause started by settlement.
- [x] A held stockpile gets at most one call per turn after the pause. Spend suite, "a held stockpile", in sequence and all at once.
- [x] A first call that would reach the ceiling is refused, keeps no usage row, and leaves the pause in place, with one alert. Spend suite, "is refused, keeps no row, and leaves the pause in place with one alert".
- [x] A continuation that reaches the ceiling starts the pause and is admitted as its grace call. Spend suite, "starts the pause, runs as its one call, and the turn stops after it".
- [x] After a lift, continuations and first calls are admitted again. Spend suite, "admits continuations, spent grace or not, and first calls".
- [x] Reinstating the turn-id exemption or discarding the pause answer makes a test fail. Both mutations ran, and each failed tests in the spend and limits suites.
- [x] The pause alert text, the server's Pause glossary entry and the server guide state the new rule. The spec session updates the client glossary after the landing. Read in `src/utils/hostedPause.js`, `CONTEXT.md`, `README.md` and `docs-internal/server.md`.

## Landed

**Not verified:**

- None. Every criterion is ticked.

**For you:**

- Nothing to judge in play. A paused day can cut post-narration passes, as Q2 accepted.

**Notes:**

- A refused continuation answers before the rate limits, so it cannot use up the minute slot of another turn's one call.
- A turn that used its one call and also expired answers `service_paused`, not `turn_expired`, until the pause ends. An unknown or foreign id still gets `turn_expired`.
- The check inside admission is also made before the rate limits with no `await` between, so removing only the admission copy fails no test. It stays because the spec puts the check in the transaction.
- If the usage insert throws after a reservation starts the pause, the rollback removes the pause and a retry alerts again. This was left as it is, because it needs a database failure.
