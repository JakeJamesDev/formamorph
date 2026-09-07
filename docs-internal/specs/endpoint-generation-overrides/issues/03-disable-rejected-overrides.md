# 03: Disable Explicitly Rejected Endpoint Overrides

Status: ready-for-agent

**Parent:** [Endpoint Generation Overrides](../spec.md)

**What to build:** When a server explicitly rejects a value supplied by an enabled endpoint override, players see the failure and the identified override is switched off for that endpoint. Its number is preserved and the player decides when to retry.

**Blocked by:** 01 — Configure Endpoint Sampler Overrides; 02 — Make Endpoint Max Output Optional.

## Acceptance criteria

- [ ] Useful server rejection information passes through AI Stream's error boundary to the consuming settings/error layer. Tests exercise controlled fetch responses through the production boundary rather than an error parser alone.
- [ ] Automatically disable only an enabled endpoint override that actually supplied the rejected request value and that the server explicitly identifies as rejected.
- [ ] The behavior covers all six overrides, including either repetition-penalty spelling and Max Output when its value came from the endpoint.
- [ ] Use the failed request's target identity and effective value source. A different endpoint selected while the request is in flight cannot receive the mutation.
- [ ] Persist the switch's disabled state for that target, retain its numeric value, and surface which override was disabled alongside the failure.
- [ ] Do not automatically retry the request or replay the turn. Prove no second request is dispatched until the player initiates a retry.
- [ ] After the player retries, the request reflects the disabled override and normal precedence. A disabled Max Output also removes its reserve and derived guidance as specified in ticket 02.
- [ ] Generic HTTP errors, ambiguous rejection information, authentication failures, and network failures leave settings unchanged. A parameter name appearing in error text without an explicit rejection does not authorize disabling it.
- [ ] Rejection of a prompt custom value, built-in prompt-specific value, or explicit internal cap leaves endpoint switches unchanged, even when the corresponding endpoint override is enabled underneath it.
- [ ] Hosted Default supports the same targeted disabling and persistence. Built-in engine controls remain unchanged.
- [ ] Settings mutation stays in the consumer rather than AI Stream. Preserve existing partial-output/failure behavior outside this targeted handling.
- [ ] Integration checks prove error display, exact persisted mutation, retained value, endpoint isolation, alias handling, masked-override protection, and a user-initiated successful retry. Do not remove the rejection trigger merely to make the recovery test pass.
- [ ] Live preview static/DOM evidence confirms the failure message and resulting disabled control. Use the existing dev route and controlled error scenario.
- [ ] Typecheck, lint, tests, and build pass; report test wall time, measure relevant coverage, and prove the guards catch removal of rejection/source checks. Update the code graph and appropriate In Progress changelog entry.

## Scope notes

Ticket 01 supplies sampler override ownership and target identity; ticket 02 supplies optional output-limit behavior and internal-cap ownership. Both must be complete to verify all six rejection paths end to end. No automatic capability probing, provider-adapter redesign, fallback retries, or speculative disabling.
