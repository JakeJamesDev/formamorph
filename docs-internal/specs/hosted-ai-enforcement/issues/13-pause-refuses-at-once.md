# 13: Pause Refuses Every Call at Once

Status: done
Base: 78e47aa
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q34)

Model rationale: removes a rule that ticket 02 added, with its tests and docs.

**What to build:** a paused day refuses every call with `service_paused`, started turns included, with no grace call. A call that would reach the ceiling starts the pause and is refused with no row kept, whether it is a first call or a continuation. A call already streaming finishes, and an admin lift still restores service.

- [x] A continuation on a paused day is refused with `service_paused`, and nothing reaches the upstream. Spend suite, "is refused with service_paused at once, and the refusal reaches no upstream".
- [x] A continuation that would reach the ceiling starts the pause, is refused, keeps no usage row, and sends one alert. Spend suite, "starts the pause, is refused, keeps no row, and sends one alert".
- [x] A held stockpile gets no calls after the pause. Spend suite, "gets no call after the pause" and "gets no call when every held turn redeems at once".
- [x] A call already streaming when the pause starts finishes and settles. Spend suite, "finishes and settles, and the next call is refused", with an upstream held open.
- [x] An unknown or foreign turn id still gets `turn_expired`, and after a lift continuations are admitted again. `turn_expired` holds on an unpaused day; on a paused day it is `service_paused` (spec session ruling A). Spend suite, "answers turn_expired ... on an unpaused day", "answers service_paused to an unknown, foreign or expired turn id too", "admits continuations and first calls again".
- [x] The per-turn pause query and its use are removed. `HostedUsage.turnStartedSince` and `pausedCallUsed` are gone; grep finds no reference.
- [x] Reinstating the grace call makes a test fail. Mutation: `&& !turnId` back on both pause checks turns 12 tests red across three suites; source restored and grepped.
- [x] The pause alert text, the server's Pause glossary entry, the README and the server guide state the new rule. `hostedPause.js` alert, `CONTEXT.md`, `README.md`, `docs-internal/server.md`. The spec session updates the client glossary after the landing.

## Landed

**Check order (spec session ruling A):** a paused day answers `service_paused` to every call, unknown and foreign turn ids included. The controller checks the pause before the turn lookup. `turn_expired` shows only on an unpaused day or after a lift. In `admitCall`, `turn_expired`, `budget_exhausted` and `window_exceeded` still come before the pause check. They are unreachable on a day the controller already saw as paused, so the controller check must stay ahead of `admitCall`.

**Not verified:** none.

**For you:** none.
