# 01: Weekly Budget on Every Call

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q1, Q13)

Model rationale: a money guard inside the admission transaction, with a bound that must be proved.

**What to build:** no client can spend past the weekly budget by holding turn ids. A continuation is admitted only while the week's spend, minus this turn's own spend, is under the budget plus the grace. Otherwise it gets `budget_exhausted`. A turn that started under budget still finishes.

This ticket owns the spend suite and the new query for a turn's spend. Ticket 02 extends both.

- [ ] A continuation past the level is refused with `budget_exhausted` and its `resetAt`, and nothing reaches the upstream.
- [ ] The grace is `turnCallCap` × the worst case of one call at window plus margin and the output cap, at the turn's model prices.
- [ ] Total spend stays within `budget + 2 × grace` for a small and a large stockpile, with the budget spent through real calls.
- [ ] An honest turn that started under budget finishes past the budget.
- [ ] The check runs inside the admission transaction, and the parallel first-call test still passes.
- [ ] The audit probes for the stockpile fold into one spend suite: the red repro turns green, and the two agent stockpile probes are folded in and recycled.
- [ ] Reinstating the old `if/else` makes the spend suite fail.
- [ ] The Turn entry in the server glossary and in the client glossary states the new rule.
