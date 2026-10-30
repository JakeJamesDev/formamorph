# Spec: Formamorph AI

Status: ready-for-agent
Spec session: hosted-ai — spec
Status note: Tier display names are open (see Further Notes). Every window, budget, price, ratio and provider term lives in the local hosted-tier note, never in this repo.

A Supporter gets **Formamorph AI**: a hosted AI endpoint that works the moment they link Patreon, with no key, no setup and a longer context than the Demo AI. Designed in a grilling session on 2026-10-30 (rulings Q1–Q31) against the client code, the server code and the provider's written terms. Two independent reviews checked it against both repos on 2026-10-30.

## Problem Statement

A player who wants good narration must find an AI provider, make an account, buy credit, copy a key and fill in an endpoint preset. Most players stop at the Demo AI, which is a small free model with a short context. They judge every world by it.

Patreon members pay for the project, but their pledge gives them flair, not a better game. There is no paid option that improves play itself.

## Solution

Each Supporter tier includes a monthly allowance of hosted AI. A new top tier sits above the two existing ones. Higher tiers get a longer context window and a larger allowance. Every tier uses the same model.

A player links Patreon as today. The app then switches once, on that device, to the built-in **Formamorph AI** preset. Turns run through Formamorph's server, which forwards them to an upstream AI provider. The player never sees a key.

The app shows how much of the month's allowance is left, as a percentage and as about how many turns. It warns twice before the allowance runs out. At the end of the allowance, Formamorph AI stops until the 1st of the next month. The player can upgrade, or switch back to their last preset in one click.

A player without a pledge sees the preset locked, with a link to join on Patreon.

## User Stories

1. As a new Supporter, I want the app to switch to Formamorph AI when my pledge first counts, so that I get what I paid for with no setup.
2. As a Supporter, I want each new device I sign in on to switch once too, so that every device starts on what I paid for.
3. As a Supporter, I want the app to never switch my preset again on a device after the first time, so that my own choice stays.
4. As a Supporter, I want to switch back to another preset at any time, so that the switch never traps me.
5. As a Supporter, I want Formamorph AI to work in the web app, the desktop app, the itch build and the Android app, so that one pledge covers every place I play.
6. As a Supporter, I want my tier to set my context window, so that a higher tier keeps more of the story in the AI's view.
7. As a Supporter, I want the model and window to be set for me and not editable, so that I can't break the preset by accident.
8. As a Supporter, I want the app to use my current window right after a tier change, so that an upgrade or downgrade takes effect on the next turn.
9. As a Supporter, I want to see my remaining allowance as a percentage and about how many turns are left, so that I can plan a session.
10. As a Supporter who plays a heavy world, I want the turns-left estimate based on my own recent turns, so that it matches how I play.
11. As a Supporter, I want to see my allowance in the app's AI settings, so that I can check it where I play.
12. As a Supporter, I want to see my allowance on my profile page on formamorph.ai, so that I can check it without opening the app.
13. As a Supporter, I want the allowance shown after each turn to include that turn, so that the number is current.
14. As a Supporter, I want a notice when I have used 75% of my allowance, so that I am not surprised later.
15. As a Supporter, I want a second notice at 90%, so that I can finish a scene or upgrade.
16. As a Supporter, I want each notice to show once per month across all my devices, and only after a turn finishes, so that it never interrupts narration.
17. As a Supporter at the end of my allowance, I want a clear message that names the reset date, so that I know when it comes back.
18. As a Supporter at the end of my allowance, I want one click to switch back to my last other preset, so that I can keep playing at once.
19. As a Supporter at the end of my allowance, I want a link to upgrade, so that I can get more this month.
20. As a Supporter, I want my allowance to reset on the 1st of each month (UTC), so that the rule is easy to remember.
21. As a Supporter who upgrades mid-month, I want the new window and allowance at once, with my spend so far counted against it, so that the upgrade feels instant and the rule stays simple.
22. As a Supporter who downgrades mid-month, I want the lower tier to apply at once, so that the rule is the same in both directions.
23. As a Supporter, I want Formamorph AI to follow Patreon's own entitlement, so that I have it exactly when Patreon says my perks are active.
24. As a former Supporter, I want a message that my pledge no longer covers Formamorph AI, so that I know why it stopped.
25. As a player without a pledge, I want to see Formamorph AI in the preset list, locked, with a link to the Patreon page, so that I learn it exists and can join in one step.
26. As a player who is not signed in, I want the locked preset to ask me to sign in first, so that I know an account is needed.
27. As a signed-in player who has not passed the 18+ age gate, I want the preset to ask me to confirm my age, so that I know why it does not work.
28. As a player who has not accepted the current privacy policy, I want the preset to say so and link to it, so that I can fix it.
29. As a Supporter whose sign-in expired mid-session, I want a message to sign in again, so that I am not left with a broken turn and no reason.
30. As a Supporter, I want a turn to keep going when Formamorph's server can't report my allowance, so that a brief outage of the usage page doesn't stop play.
31. As a Supporter, I want streamed narration to arrive as fast as with any other endpoint, so that the hosted tier feels like a normal preset.
32. As a Supporter, I want every pass of a turn (narration, stats, choices, memory and the rest) to complete once the turn has started, so that I never get half a turn at the cap.
33. As a Supporter, I want passes I have pinned to another preset to keep using it, so that my per-prompt routing still works.
34. As a Supporter with a pass pinned to Formamorph AI that I can't use right now, I want one message per turn, not one per pass, so that errors stay readable.
35. As a Supporter, I want Tools and Native Reasoning to work on Formamorph AI with no probing delay, so that worlds with Tools work from the first turn.
36. As a Supporter, I want help-window questions to use Formamorph AI when it is my active AI, counted against my allowance, so that help works with no setup.
37. As a Supporter, I want a turn that fails on the server to show the same error details as any endpoint error, so that I can report it.
38. As a Supporter, I want my prompts and replies never stored or logged on Formamorph's server, so that my stories stay private.
39. As a Supporter, I want the privacy policy to say that my turns go to a third-party AI provider, so that I know where my text goes.
40. As a Supporter on an old app build, I want a clear message to update, so that a changed server never breaks play silently.
41. As a Supporter during a global pause, I want a message that says the service is paused, not that my allowance is gone, so that I don't think I was cut off.
42. As a staff member, I want to grant a tier to an account without a pledge, with an end date, so that testers and giveaway winners get access.
43. As a staff member, I want a grant to end by itself on its date, and to revoke one early, so that access never outlives its purpose.
44. As an admin, I want to change each tier's window and allowance in server settings, so that I can tune caps from real spend with no deploy.
45. As an admin, I want a list of approved models and a picker that sets the one every player uses, so that a model change needs no client release or deploy.
46. As an admin, I want those settings hidden from moderators, so that cost data stays with the people who need it.
47. As an admin, I want a global daily spend ceiling that pauses all hosted AI when hit, with an email and an in-app alert, so that a bug or an attack can't run up an unbounded bill.
48. As an admin, I want to lift a pause for the rest of the day, so that service resumes once the cause is fixed.
49. As an admin, I want an alert when the provider account balance runs low, so that service never stops because of an empty balance.
50. As a staff member, I want a per-account limit on parallel requests and on requests per minute, so that one shared account can't serve many players.
51. As an admin, I want each call's usage recorded (subject, turn, tokens, cost, cost source, time, status), so that I can see spend per account, per turn and per day.
52. As an admin, I want a report that compares recorded spend with estimated spend, so that I can check the meter against the provider's bill.
53. As the project, I want spend to follow the Patreon membership, not the Formamorph account, so that relinking or a new account never resets an allowance.
54. As the project, I want the provider key only in the server environment, so that no client build, backup or staff screen can leak it.
55. As the project, I want every forwarded call to carry an anonymous, stable per-subject id, so that the provider's abuse tooling can act on one player without our users' names.
56. As the project, I want a Supporter's existing flair and Supporter content to work for the new top tier too, so that the hosted tier adds value and removes none.
57. As the project, I want tier display names to come from one place, so that renaming a tier is a copy change.
58. As a World author, I want my world to run on Formamorph AI with no changes, so that Supporters can play it.

## Implementation Decisions

**Tiers and entitlement**
- The Patreon tier mapping gains a third tier key, `supporter_top`, above `supporter` and `supporter_plus`. The key is internal and stays when the tier gets its display name. The `patreon_links.tier` CHECK constraint allows only the two existing keys, so a schema step rebuilds that table. The existing tiers keep their keys and prices.
- The new key joins every tier surface on both sides in one change: the Supporter content qualifier, the Supporters wall sort, the client tier type, the flair map and its labels. The new tier's flair color is a new visual pattern and needs the user's approval.
- Entitlement follows Patreon (Q25): an account is entitled while `currently_entitled_tiers` holds a mapped tier, exactly as Supporter content works today. The webhook and the hourly reconcile keep it current. No tier means no access, at once, with no grace period.
- A staff grant names a tier and an end date. When a grant and a pledge both exist, the higher tier wins.
- Every hosted request requires the age-gate policy to be accepted. The proxy checks acceptance directly and refuses when it can't confirm it. It never uses the helper that lets requests through when the policy is inactive.

**Spend subject**
- Spend is summed per **subject**, not per account: the Patreon user id for a pledge, the grant id for a grant. Relinking a Patreon membership to another account, or deleting and re-creating an account, keeps the same subject and the same month's spend.
- Usage rows have no cascading foreign key. Account erasure sets their account id to null and keeps the rows, so the daily ceiling sum stays correct.
- The anonymous `user` id sent upstream is an HMAC of the subject with a dedicated server secret that is never rotated.

**Server proxy (FormamorphServer)**
- A new route module accepts OpenAI-compatible chat-completions requests, streamed and non-streamed, behind `protect`. It has its own JSON body limit, sized for the largest window. It skips the global per-IP rate limiter, because it has per-account limits. The deploy checklist includes Caddy's request body cap.
- The route requires a minimum client version through the existing per-route client-version check.
- The upstream key lives in the server environment, never in the settings table.
- The proxy builds the upstream body from an allow-list: `messages`, `stream`, `tools`, `tool_choice`, `max_tokens`, `stop`, `response_format` and the sampler fields. It drops everything else, including `n`, `user`, routing fields, caching fields and unknown keys. `max_tokens` is required and capped from settings. The proxy sets the model, routing, reasoning options, the stream usage option and the anonymous `user` id itself. It never enables upstream prompt caching.
- Image content parts are refused in phase one (Q27).
- The proxy estimates prompt tokens from the character count of `messages` and tool schemas with a ratio from settings. It refuses with `window_exceeded` only when the estimate exceeds the window plus a margin from settings. It records the upstream prompt token count next to the estimate so the ratio can be tuned.
- When the client disconnects, the proxy aborts the upstream call.
- The proxy aborts an upstream call that sends nothing for longer than an idle limit from settings, and ends the stream with an SSE error event. The call settles from its estimate.
- The proxy owns its error handling. It never logs request bodies or upstream bodies, including on a parse error.

**Admission**
- Order for each request: client version → auth (via `protect`) → age gate → entitlement → global pause → per-account parallel limit → per-account rate limit → turn → budget → window.
- **Turns.** The first call of a turn has no turn id. If admitted, the server issues one and returns it. The client sends it on every later call of that turn, background passes included. A turn id expires after a time limit from settings and admits at most a set number of calls. A call with a valid turn id skips the budget check, so a started turn always completes (story 32). The budget check runs only on a turn's first call.
- **Reservation.** Every admitted call immediately records a usage row with status `open` and its worst-case cost: the estimated prompt plus the capped `max_tokens`. Budget and ceiling sums include open rows. So parallel requests can't all pass the same sum, and the overrun past a budget is at most one turn.
- The per-account parallel limit is at least the largest number of passes a turn runs at once.
- The client-version check is the existing per-route gate, with the proxy route in the staff-edited minimums map. It runs before auth and answers its existing 426 `CLIENT_UPDATE_REQUIRED`; the client maps that to `outdated`.
- Refusals use the server's error shape (`success: false`, `code`, `error`). Codes and statuses: `invalid_request` 400 (bad JSON, no `messages`, missing or non-integer `max_tokens`), `image_not_supported` 400, `age_gate_required` 403, `not_entitled` 403, `service_paused` 503 (also when the server has no active model or upstream configuration), `rate_limited` 429, `turn_expired` 409, `budget_exhausted` 402, `window_exceeded` 413, `upstream_error` 502. Upstream error bodies never reach the client: an SSE event with a top-level `error` becomes our `upstream_error` error event and the stream closes, and a non-streamed 200 whose body is an error object becomes 502 `upstream_error`. Every other byte passes through unchanged.
- A `max_tokens` above the cap is clamped to the cap, not refused. A refusal also carries the current hosted state where it helps the client: the window on `window_exceeded`, the reset time on `budget_exhausted`.
- The existing `protect` refusals stay as they are and are part of the client's map: 401 on an expired or invalid token, the privacy-policy refusal, the suspended refusal and the rename refusal.
- A failure after the stream has started is sent as a final SSE event, `event: error` with a refusal-shaped body (`upstream_error` for upstream failures and the idle abort), then the stream closes.

**Metering**
- One usage table: subject, account id (nullable), turn id, tier at the time, estimated prompt tokens, prompt tokens, cached tokens, output tokens, cost, cost source, start time, duration, status. No prompt or reply text, ever. Indexes on subject plus start time, and on start time. Rows older than a retention period from settings are deleted by the existing hourly job.
- A row settles from the upstream usage block. Cost comes from the usage block when it reports one (cost source `upstream`); otherwise it is token counts times admin-set prices (`computed`). A call that ends with no usage block (client abort, upstream error, restart) settles from its estimate (`estimated`). The hourly job settles any row still `open` after the turn time limit as `estimated`.
- An `estimated` settle charges the estimated prompt plus output tokens estimated from the characters already streamed. The hourly sweep, which knows nothing streamed, keeps the worst-case reservation.
- Costs are stored as integer micro-dollars. Model prices in settings are dollars per million tokens (`prompt`, `completion`, optional `cached` falling back to `prompt`); an active model without prompt and completion prices answers `service_paused`.
- The turn id travels in the `X-Formamorph-Turn` header both ways and is listed in CORS allowed and exposed headers. A turn is valid while its first row is younger than the turn limit, its call count is under the cap, and its subject matches the caller. A first call refused at budget or window issues no turn.
- Spend subjects are the Patreon user id, or `grant:<id>` for a grant.
- The monthly budget sum covers the subject's rows since 00:00 UTC on the 1st. A tier change applies at once against that same sum.
- The global daily ceiling sums every row since 00:00 UTC. When a sum reaches it, the server sets a pause and alerts admins once: email to a staff address from the environment, plus an in-app admin message. New first calls are refused with `service_paused`; calls of turns already admitted finish.
- An admin can lift a pause. A lift holds until 00:00 UTC. The ceiling check restarts with the new day.
- The hourly job reads the provider account balance through the provider's balance endpoint, with the same server key, and alerts admins when it falls below a threshold from settings.
- A daily job reads the provider's per-day spend for the server key and stores it next to the recorded day sum. The spend-versus-estimate report shows both.

**Server settings**
- One admin-only settings record holds, per tier: window, monthly budget and a fallback cost per turn for the turns estimate. Globally: the approved model list and the active model, daily ceiling, balance alert threshold, upstream idle limit, `max_tokens` cap, token estimate ratio and margin, turn time limit and call cap, parallel and per-minute limits, warning thresholds, retention period, and per-token prices for computed cost.
- **Approved models (Q31).** Each entry holds the upstream model id, its routing options, its per-token prices and its capability record (Tools, reasoning dialect). Exactly one entry is active, and every tier uses it. Admins add, edit and remove entries and pick the active one in an admin picker; the active entry can't be removed. Players never choose a model. A change applies to the next admitted turn; turns already admitted finish on the model they started with.
- Moderators can't read or write it. Values never appear in either repo; the local note holds the starting values.

**Hosted state API**
- A new account route returns the hosted state: tier key, state, window, `max_tokens` cap, the token estimate margin, a capability record (Tools, reasoning dialect, served model id), percent used, about-turns-left, reset time, and which warnings this account has acknowledged this month. It never returns dollar amounts.
- Turns left uses the subject's average cost per turn over its recent turns, grouped by turn id. With too few recent turns it uses the tier's fallback figure.
- A route acknowledges a warning for this month. Warnings are per account, so each shows once across devices.
- The proxy sends the updated percent used and turns left as `event: usage` (`percentUsed`, `turnsLeft`, `resetAt`) after the usage settles and before the stream's final `[DONE]`, and as the `X-Formamorph-Usage` header on non-streamed calls. The header is listed in CORS exposed headers.
- The hosted-state route answers 200 for every signed-in account, with state `locked` or `age-gate` when not entitled. The client derives signed-out, privacy, suspended and outdated from the existing refusals.
- Entitlement is the highest tier among a live pledge and live grants; on a tie the pledge wins. The spend subject follows the winning source. Grants are deleted with their account; spend rows stay.
- Each usage row records its model. Later calls of a turn use the turn's first model while it stays approved.
- Staff routes: create, list and revoke grants; read a subject's month spend; read and lift the pause; read the spend-versus-estimate report. Settings routes, including the approved model list and the active-model picker, are admin-only.
- The hosted state's capability record and served model id come from the active model entry.

**Client (formamorph)**
- `textEndpointPresets` gains a virtual built-in preset, **Formamorph AI**, next to Demo AI. It is never stored and has no Extra Parameters. Its endpoint is the proxy route on the API origin. The preset's endpoint, model and window can't be edited.
- Its credential is read from the auth service at send time, never cached in a resolved endpoint, so a sign-out or account switch mid-turn never reuses the old token.
- Its window comes only from the hosted state, active or routed, never from the context-detect cache. A `window_exceeded` refusal updates the window and refetches the hosted state. The client budgets prompts to the window minus the server's margin.
- Its capabilities come only from the hosted state. The client never probes Formamorph AI, and caches capability by the served model id, so a server-side model change takes effect on the next fetch.
- Preset states: `signed-out` (no token, or a 401), `privacy-required`, `suspended`, `age-gate`, `locked` (no entitlement), `ready`, `warned`, `exhausted`, `paused`, `outdated`, and `unavailable` (hosted state can't be fetched; turns still send, and the server stays the authority). Each state except `ready`, `warned` and `unavailable` shows its reason and action: sign in, review the policy, confirm age, join on Patreon, upgrade, switch back, update the app.
- The per-prompt routing code learns the new built-in id. A pass pinned to another preset keeps it. A pass pinned to Formamorph AI in a non-ready state fails with its state message once per turn.
- The Request Transport treats the proxy as an ordinary endpoint. It sends the turn id header, reads the final usage event, and maps every refusal code to a classified failure with the existing error details. Background passes never raise their own toast for a hosted refusal.
- The one-time switch is per device (Q28): when the hosted state first reports an entitlement on a device, the app selects Formamorph AI and records it locally. It also records the preset that was active before, for the one-click switch back.
- Warnings show as one notice after the turn commits, never during a stream, then are acknowledged on the server.
- Formaquestion follows the player's active AI, as today. On Formamorph AI its calls are billed like turns (Q26); each help question is its own turn.
- Tier display names stay in the existing Supporter flair label map, shared by the app and the site.
- New screens and states get dev-route entries: the locked, exhausted, paused and outdated preset states, and both warning notices.
- No world or save export shape changes. Presets live in local storage.

**Site (formamorph.ai)**
- The profile page shows the hosted state: tier, percent used, about-turns-left and the reset date. The hosted-state service joins the site bundle boundary's allowed list.

**Privacy policy**
- The server's privacy policy names "a third-party AI provider" as a category of recipient for Formamorph AI turns. It does not name the provider. The text is the user's to write.

**Launch**
- Phase one opens as a closed beta on staff grants, then to all Supporters.
- Before opening, a load test runs the proxy against a slow fake upstream at the planned parallel load.
- A changelog entry is added under In Progress when the client ships.

## Testing Decisions

- A good test drives external behavior through the seam and asserts what a player or staff member would observe: an HTTP status and code, a streamed body, a recorded usage row, a preset state, a request on the wire. It never asserts on internal helpers.
- Each guard is proven by reinstating its bug once (for example, remove the reservation and see the parallel-budget test fail).
- **Seam 1: the server proxy route**, tested over HTTP like the existing server tests with the shared test context, against a fake upstream that streams canned SSE with and without a usage block, and can hang or fail mid-stream. Cases:
  - Every admission step and refusal code, including the existing `protect` refusals.
  - The body allow-list, the `max_tokens` cap, the model override and the `user` HMAC.
  - Switching the active model: the next turn uses the new model, its prices and its capability record; an admitted turn finishes on its old model; the active entry can't be removed.
  - Image parts and the window estimate with its margin.
  - Turn id issue, expiry and call cap.
  - Reservation under parallel requests, and the overrun bound.
  - Settle from upstream, computed and estimated, plus the client-abort case, an upstream stall past the idle limit, and the open-row sweep.
  - Month and day sums across their UTC boundaries; tier change mid-month.
  - Relink and account erasure keep the subject's spend.
  - Grant expiry; pause, alert once, and lift until 00:00 UTC.
  - The parallel counter released on close, error, abort and refusal.
  - No log line or row ever holds request text.
  - The new tier key across the Supporter content and wall surfaces.
  - Prior art: the age-gate policy, Supporter content and Patreon webhook tests.
- **Seam 2: the client endpoint-preset module**, extended in its existing test file. Cases: each preset state from a given hosted state, the window and capability taken from the hosted state, and that the preset's endpoint, model and window can't be edited.
- **Seam 3: the Request Transport and SettingsContext against a fake proxy**, using the existing SSE response fixtures. Cases:
  - The turn id header on every pass of a turn.
  - The token read at send time.
  - The final usage event updating the shown state.
  - Each refusal code mapped to its message.
  - `window_exceeded` refetching the state.
  - The one-time switch per device.
  - One message per turn for a pinned pass.
  - No toast from background passes.
  - The warning notice after commit.
- One shared list of refusal codes is checked by a test in each repo, so the server and client can't drift.
- No live provider calls in the gates. Live cost checks stay in the local probe scripts.

## Out of Scope

- Steam subscriptions and the Steam buyers' free tier (a later phase; it waits on the 18+ ruling for the Steam build).
- One-off top-ups or paying for extra allowance.
- A cheaper fallback model at the cap.
- Image inputs.
- Changes to the Demo AI or the web free tier.
- Storing prompt or reply text for support.
- A token refresh route. An expired sign-in asks the player to sign in again.
- Naming the provider anywhere in the repos.

## Further Notes

- **Tier display names are open.** The user will workshop names. Today's Supporter and Supporter+ names signaled "support more", not "get more", and may change. Build against tier keys; names come from the one label map.
- The Patreon tier descriptions must change to list the hosted allowance. That is the user's task on Patreon.
- The glossary needs a **Formamorph AI** entry, an entry for the new top tier once it has a name, and entries for **Hosted state** and **Spend subject**.
- Server tickets carry `Repo: FormamorphServer`.
