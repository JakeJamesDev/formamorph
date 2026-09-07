# 01: Configure Endpoint Sampler Overrides

Status: ready-for-agent

**Parent:** [Endpoint Generation Overrides](../spec.md)

**What to build:** Players can independently override Temperature, Repetition Penalty, Top P, Top K, and Min P on each external endpoint, including hosted Default. Changes persist, follow per-prompt routing, and reach actual requests with the agreed prompt precedence.

**Blocked by:** None (can start immediately).

## Acceptance criteria

- [ ] All five sampler controls are available on user-created cloud/local endpoints and hosted Default. Each has its own enabled state and remembered numeric value.
- [ ] Disabled controls show Endpoint default and preserve their numbers through re-enabling, endpoint changes, and reload. Hosted Default tuning persists without allowing its connection details to change.
- [ ] Existing and newly created endpoint configurations start these five overrides off. Seed remembered values from existing central defaults or copied values without representing them as known server defaults.
- [ ] Sampling settings remain isolated per endpoint configuration. Every request uses its resolved target's settings, including when prompt routing differs from the currently selected endpoint.
- [ ] Temperature and Repetition Penalty resolve as enabled prompt custom value, then built-in prompt-specific value, then enabled endpoint override, otherwise omission. Top P, Top K, and Min P use their enabled endpoint override or are omitted.
- [ ] Inactive overrides send neither null nor remembered/default substitute values. Valid zero values remain valid enabled overrides.
- [ ] Both existing repetition-penalty spellings retain their request behavior. Preserve target identity and the effective value's source in the request description so later rejection handling can distinguish endpoint tuning from prompt tuning.
- [ ] Existing prompt controls, built-in prompt-specific values, reasoning behavior, and built-in engine controls remain unchanged. Explain endpoint fallback precedence in settings help.
- [ ] Existing Max Output behavior remains intact in this slice; its switch, new-endpoint default change, and narration effects belong to ticket 02.
- [ ] Captured requests and existing settings tests prove mixed switches, precedence, target isolation, persistence, hosted Default, and built-in regression behavior. Tests call production interfaces rather than duplicating resolution logic.
- [ ] Live preview checks through the existing dev route prove the visible controls, disabled labels, endpoint switching, and keyboard interaction with static/DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time, measure relevant coverage, and prove the new guards detect their protected regressions. Update the code graph and appropriate In Progress changelog entry.

## Scope notes

Extend the existing endpoint settings and AI Request Spec interfaces. No preparatory refactor ticket or new Turn Pipeline injection point is required. No world/save export, prompt-preset sharing, or version changes.
