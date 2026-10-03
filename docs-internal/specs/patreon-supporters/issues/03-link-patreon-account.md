# 03: Link a Patreon Account

Status: ready-for-human
Status note: Built in FormamorphServer f69efa0 (server base 6831227). The review added the confirm step from the link-injection ruling: `POST /api/users/me/patreon/confirm` with `{ token }` answers 200 with the status, 400 `PATREON_CONFIRM_REFUSED`, or 409 `PATREON_TAKEN`. The callback answers `?patreon=confirm&token=…`, `taken`, `denied`, `expired`, or `failed`. Server suite: 1903 tests green in 22 s. Follow-up 5f0927b: every callback failure now redirects with `failed` instead of hanging (spec-session review); suite 2056 green in 28 s.
Base: 8fd568fe
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Rulings Q1, Q14; A1, A3, A6, A7; Implementation Decisions › The link, The tier rule, Staying current, Account routes)

Model rationale: an OAuth flow with a signed state, a uniqueness rule, and the first third-party integration on this server. A mistake is a security fault.

## What to build

A signed-in account starts a Patreon link, approves on Patreon, and comes back linked. The server then knows the account's tier. The account can read its own status and can unlink.

One new module owns every call to Patreon. Tests replace it with a fake. No test calls Patreon.

## Acceptance criteria

- [ ] A schema step adds the link table: account, Patreon user ID, tier, pledge start, flair toggle (default on), last check time. The account and the Patreon user ID are each unique. The boot-schema drift test passes.
- [ ] An authenticated start route returns Patreon's authorize URL with the `identity` scope. The `state` is signed, short-lived, and bound to the account.
- [ ] The callback route verifies `state`, exchanges the code, reads the Patreon user ID, discards the member's tokens, stores the link, reads the tier, and redirects to the site's account page with a result. A forged or expired `state` stores nothing.
- [ ] The tier is the highest mapped tier in `currently_entitled_tiers`, read from the campaign member list with the creator token. Two configuration values hold the tier IDs. An unmapped tier gives no tier.
- [ ] A link to a Patreon user ID that another account holds is refused with a clear error. After that account unlinks, the link succeeds.
- [ ] A status route returns the caller's own link: linked or not, tier, pledge start, flair toggle.
- [ ] An unlink route deletes the link. Account deletion deletes the link, and the Patreon user ID can link again.
- [ ] The Patreon module sends a `User-Agent` header on every request and is the only code that calls Patreon.
- [ ] The new environment values are in the example environment file with a comment for each.
- [ ] Route tests cover each tier, no tier, an unmapped tier, a member absent from the list, the duplicate link, unlink, and account deletion. Each guard bites when its bug returns.
- [ ] Server gates green.
