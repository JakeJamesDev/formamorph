# 06: Hosted State, Grants and Admin Routes

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai/spec.md` in formamorph (Hosted state API, Server settings, Tiers and entitlement)

Model rationale: mostly routes over data ticket 04 already records; the contract it defines is what three client tickets build on, so it needs care but little novel risk.

**What to build:** a signed-in account reads its hosted state, and staff manage access and models. This ticket owns the hosted-state contract that tickets 07, 09 and 10 build on. Staff grants become a second source of entitlement with their own spend subject.

- [ ] The hosted-state route returns tier key, state, window, `max_tokens` cap, token margin, the active model's capability record and served model id, percent used, about-turns-left, reset time and acknowledged warnings; it never returns dollar amounts (test asserts no cost field).
- [ ] About-turns-left uses the subject's recent cost per turn grouped by turn id, and the tier fallback with too few turns.
- [ ] A route acknowledges a warning for the month, per account.
- [ ] The proxy sends updated percent used and turns left as a final SSE event after settling, and as a header on non-streamed calls; the header is in CORS exposed headers.
- [ ] Staff can create, list and revoke grants with an end date; a grant entitles an account; an expired or revoked grant stops it; with a grant and a pledge the higher tier wins; grant spend sums by grant id.
- [ ] Admin routes edit the approved model list, pick the active model, read a subject's month spend and read the spend-versus-estimate report (recorded vs provider daily spend from ticket 05 when present); moderators get 403.
- [ ] A model switch applies to the next admitted turn; an admitted turn finishes on its old model.
- [ ] The contract is written down in the server's API docs.
