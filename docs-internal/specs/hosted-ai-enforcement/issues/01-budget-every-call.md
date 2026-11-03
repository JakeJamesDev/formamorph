# 01: Weekly Budget on Every Call

Status: ready-for-human
Base: 6a1f462
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q1, Q13)

Model rationale: a money guard inside the admission transaction, with a bound that must be proved.

**What to build:** no client can spend past the weekly budget by holding turn ids. A continuation is admitted only while the week's spend, minus this turn's own spend, is under the budget plus the grace. Otherwise it gets `budget_exhausted`. A turn that started under budget still finishes.

This ticket owns the spend suite and the new query for a turn's spend. Ticket 02 extends both.

- [x] A continuation past the level is refused with `budget_exhausted` and its `resetAt`, and nothing reaches the upstream. `hostedAiSpend`: "refuses a continuation past the level".
- [x] The grace is `turnCallCap` × the worst case of one call at window plus margin and the output cap, at the turn's model prices. `hostedAiSpend`: "the level a continuation stops at", one case per input, with hand-computed levels.
- [x] Total spend stays within `budget + 2 × grace` for a small and a large stockpile, with the budget spent through real calls. `hostedAiSpend`: "spends the same, within the bound" (4 and 24 turns) and "every held turn redeems at once".
- [x] An honest turn that started under budget finishes past the budget. `hostedAiSpend`: "finishes past the budget", and the existing `hostedAiMetering` test.
- [x] The check runs inside the admission transaction, and the parallel first-call test still passes. `admitCall` in `hostedMeter.js`; `npm test` green.
- [x] The audit probes for the stockpile fold into one spend suite: the red repro turns green, and the two agent stockpile probes are folded in and recycled. The repro's `budget * 2` limit became the spec's `budget + 2 × grace`. The cases that pinned the old overrun became bound assertions. The pause case stays with ticket 02.
- [x] Reinstating the old `if/else` makes the spend suite fail. Mutation run: 10 of `hostedAiSpend` go red. Nine other mutations of the guard and the grace also go red.
- [ ] The Turn entry in the server glossary and in the client glossary states the new rule. Server entry done in `CONTEXT.md`. The client entry moved to the spec session.

## Landed

**Not verified**

- Client glossary entry: the spec session ruled that it adds this entry after the landing, so this ticket did not edit formamorph.
- The bound against a prompt denser than `tokenRatio`: the bound holds only while a call settles within its reservation, and an upstream `usage` block can settle above it. The spec session recorded this gap and ruled that settlement stays uncapped, so the suite tests the bound with settled cost within the reservation.

**For you**

- Nothing for this ticket.
