# 13: Pause Refuses Every Call at Once

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q34)

Model rationale: removes a rule that ticket 02 added, with its tests and docs.

**What to build:** a paused day refuses every call with `service_paused`, started turns included, with no grace call. A call that would reach the ceiling starts the pause and is refused with no row kept, whether it is a first call or a continuation. A call already streaming finishes, and an admin lift still restores service.

- [ ] A continuation on a paused day is refused with `service_paused`, and nothing reaches the upstream.
- [ ] A continuation that would reach the ceiling starts the pause, is refused, keeps no usage row, and sends one alert.
- [ ] A held stockpile gets no calls after the pause.
- [ ] A call already streaming when the pause starts finishes and settles.
- [ ] An unknown or foreign turn id still gets `turn_expired`, and after a lift continuations are admitted again.
- [ ] The per-turn pause query and its use are removed.
- [ ] Reinstating the grace call makes a test fail.
- [ ] The pause alert text, the server's Pause glossary entry, the README and the server guide state the new rule. The spec session updates the client glossary after the landing.
