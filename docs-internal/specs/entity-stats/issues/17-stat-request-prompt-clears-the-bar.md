# 17: Stat Request Prompt Clears the Bar

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: prompt work judged only by probe numbers on two models that fail in opposite directions; a release blocker.

Parent: [Entity Stats spec](../spec.md)

## What to build

The stat request's prompt is tuned until it clears Q28 on both models with entities in the request. Ticket 05 landed with two misses (Q56): on the cloud model the max keys leave social Trust shifts at 0 (recall 59% against C3's 69–70%), and on Cydonia the model invents player changes (73 against C3's 68). The schema shape (Q36) stays; only prompt text changes. This ticket closes the Q45 release blocker. Rulings Q28, Q45, Q56.

## Acceptance criteria

- [ ] Each wording change is an A/B in the entity stats probe on the cloud default model and Cydonia, with today's shipped request and C3 as in-batch arms, at least 6 runs per case on the cloud model.
- [ ] The shipped prompt meets Q28 on both models: exact and recall within 5 points of C3, 0 wrong signs, invented changes not above C3's, and 0 invented max changes.
- [ ] On Cydonia, invented player changes are not above C3's (Q45). Not met (Q66): tracked as [release blocker 03](../../release-blockers/issues/03-cydonia-stat-request.md).
- [ ] With stat groups in the request (Q64), the `push-bram` case's invented player changes on the cloud model fall back to the flat request's level. Whichever of tickets 10 and 17 lands second re-runs this.
- [ ] Prompt text follows the prompt-writing guide: positive contracts, no example values a small model can parrot.
- [ ] The numbers for every arm tried go in the commit body. If no wording clears the bar, the ticket stops and reports to the user.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
