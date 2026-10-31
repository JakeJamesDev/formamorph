# 13: Warning Thresholds in the Hosted State

Status: done
Base: eaf4a84
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Hosted state API, Server settings)

Model rationale: one field added to an existing route's response, with its contract doc and tests.

**What to build:** the hosted-state route carries the warning thresholds from the admin `hosted_ai` setting, so the client stops keeping its own copy. Found in the close review: the client hardcodes them, so an admin change makes its acknowledgments fail with 400, and an unset value means the server never reports `warned`.

- [x] The hosted state returns `warnThresholds` (ascending integers) from the setting. Test: "returns a custom list and accepts exactly those values".
- [x] An unset `warnThresholds` falls back to a default in the server config, so `warned` is always reachable; the state returns that default. Test: "falls back to the default" (null and `[]`), asserts `warned` at 80%.
- [x] The README's hosted-state contract lists the field.
- [x] Tests cover a custom list, the default, and that the acknowledgment route accepts exactly the returned values. 35 pass in `tests/hostedAiState.test.js`; `npm test` gate green.

## Landed

**Not verified**
- Nothing outstanding.

**For you**
- The default is `[75, 90]` (`DEFAULT_WARN_THRESHOLDS` in `src/config/hostedAi.js`). The ticket named no value, so confirm it matches what the client showed. An empty list also counts as unset.
- `warnThresholds` is `null` in the `locked`, `age-gate` and `paused`-without-model states, like the other config fields.
