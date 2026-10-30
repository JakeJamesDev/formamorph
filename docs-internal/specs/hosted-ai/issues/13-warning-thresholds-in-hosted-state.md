# 13: Warning Thresholds in the Hosted State

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Hosted state API, Server settings)

Model rationale: one field added to an existing route's response, with its contract doc and tests.

**What to build:** the hosted-state route carries the warning thresholds from the admin `hosted_ai` setting, so the client stops keeping its own copy. Found in the close review: the client hardcodes them, so an admin change makes its acknowledgments fail with 400, and an unset value means the server never reports `warned`.

- [ ] The hosted state returns `warnThresholds` (ascending integers) from the setting.
- [ ] An unset `warnThresholds` falls back to a default in the server config, so `warned` is always reachable; the state returns that default.
- [ ] The README's hosted-state contract lists the field.
- [ ] Tests cover a custom list, the default, and that the acknowledgment route accepts exactly the returned values.
