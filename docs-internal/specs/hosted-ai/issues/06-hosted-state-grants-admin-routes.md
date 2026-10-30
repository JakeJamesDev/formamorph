# 06: Hosted State, Grants and Admin Routes

Status: ready-for-human
Base: 23a02ed
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Hosted state API, Server settings, Tiers and entitlement)

Model rationale: mostly routes over data ticket 04 already records; the contract it defines is what three client tickets build on, so it needs care but little novel risk.

**What to build:** a signed-in account reads its hosted state, and staff manage access and models. This ticket owns the hosted-state contract that tickets 07, 09 and 10 build on. Staff grants become a second source of entitlement with their own spend subject.

- [x] The hosted-state route returns tier key, state, window, `max_tokens` cap, token margin, the active model's capability record and served model id, percent used, about-turns-left, reset time and acknowledged warnings; it never returns dollar amounts (test asserts no cost field). (hostedAiState: returns the tier, window, caps, model and usage, and no cost field)
- [x] About-turns-left uses the subject's recent cost per turn grouped by turn id, and the tier fallback with too few turns. (hostedAiState: average by turn id, fallback with too few turns, open turns left out)
- [x] A route acknowledges a warning for the month, per account. (hostedAiState: per account, repeat, bad threshold, earlier month)
- [x] The proxy sends updated percent used and turns left as a final SSE event after settling, and as a header on non-streamed calls; the header is in CORS exposed headers. (hostedAiState: usage event before [DONE], header on non-streamed calls, CORS exposed)
- [x] Staff can create, list and revoke grants with an end date; a grant entitles an account; an expired or revoked grant stops it; with a grant and a pledge the higher tier wins; grant spend sums by grant id. (hostedAiState grants block)
- [x] Admin routes edit the approved model list, pick the active model, read a subject's month spend and read the spend-versus-estimate report (recorded vs provider daily spend from ticket 05 when present); moderators get 403. (hostedAiState admin routes block)
- [x] A model switch applies to the next admitted turn; an admitted turn finishes on its old model. (hostedAiState switching the model block: old model and old price)
- [x] The contract is written down in the server's API docs. (README, Formamorph AI hosted state section)

## Landed

**Not verified**
- Provider daily spend in the report: the code reads ticket 05's `hosted_provider_spend` table (`day`, `provider_micros`) when it exists. The test builds a table of that shape; it never ran against 05's real landing.
- The `paused` state means "no usable model or upstream config" only. Ticket 05's global pause is not read here.

**For you**
- The spec lists "read a subject's month spend" under staff routes, and the ticket says moderators get 403. Spend and the report are admin-only; grants are staff.
- The state's `model.id` is the approved entry's own `id`, not the upstream model id.
- Once ticket 05 lands, the state route should also report `paused` for its global pause.
