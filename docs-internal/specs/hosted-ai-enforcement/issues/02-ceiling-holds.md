# 02: Daily Ceiling Holds for Started Turns

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q2, Q24, Q29)

Model rationale: a transaction subtlety, because the pause must survive a refusal that keeps no row.

**What to build:** a paused day stops started turns too. Each turn gets one grace call at or after the pause began, and later calls get `service_paused`. A first call whose reservation would reach the ceiling starts the pause and is refused. A continuation that reaches the ceiling starts the pause and uses its grace call. An admin lift still restores service.

- [ ] A turn's second call on a paused day is refused with `service_paused`, and its first call after the pause is admitted.
- [ ] A held stockpile gets at most one call per turn after the pause.
- [ ] A first call that would reach the ceiling is refused, keeps no usage row, and leaves the pause in place, with one alert.
- [ ] A continuation that reaches the ceiling starts the pause and is admitted as its grace call.
- [ ] After a lift, continuations and first calls are admitted again.
- [ ] Reinstating the turn-id exemption or discarding the pause answer makes a test fail.
- [ ] The pause alert text, the Pause glossary entries in both repos and the server guide state the new rule.
