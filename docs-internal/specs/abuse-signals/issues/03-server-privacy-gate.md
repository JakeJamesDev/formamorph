# 03 — Server: the Privacy Policy as a third policy, seeded disabled, enforced when enabled

Status: done
Type: task
Blocked by: 01
Spec: ../spec.md (Implementation Decisions › The Privacy Policy)

Repo: FormamorphServer. Deploys ahead of the client because the row ships disabled.

## Task

- **Policy id**: add a third fixed id beside the upload gate and tag notice. It has a title, body, `enabled`, and an acceptance version, and is editable in the existing admin policies endpoints. It carries no tags.
- **Seed**: a schema step inserts the row with the body from ticket 01, `enabled = false`, version 1. Idempotent — never overwrites an edited row.
- **Read**: the policies endpoint returns it with an `accepted` flag exactly as the upload gate is returned.
- **Accept / decline** endpoints mirror the upload gate's, including the per-user reset and the everyone-reset via version bump.
- **Enforcement middleware**: applied to every authenticated route except register, login, logout, password change, and the policy routes. When the policy is enabled and the caller has not accepted the current version, respond 403 with a fixed code (`PRIVACY_REQUIRED`) and the message "Formamorph needs updating to continue." When disabled, pass through. Suspended accounts are subject to it like anyone else.
- Document the code in the server README's error-code list beside `TERMS_REQUIRED`.

## Acceptance

- With the row disabled (the seeded state), no route behavior changes and the full existing suite passes untouched.
- With it enabled and unaccepted: like, publish, comment, follow, feedback, reports, and the user profile all return the 403 code; register, login, change-password, and every policy route do not.
- After accept, everything passes. After a version bump, the same user is refused again until re-accepting.
- Decline records the response and refuses nothing extra on its own — the refusal is the middleware's.

## Tests

- Supertest. Prior art: `tests/policies.test.js` (accept/decline/reset), `tests/suspendedAccess.test.js` (route-by-route matrix), `tests/tokenInvalidation.test.js`.
- Prove the exemption list by removing one exemption and watching the login test fail.

## Answer

Shipped in FormamorphServer `6513890` ("Seed The Privacy Policy And Gate Every Route On It") and `f265c35` (an unaccepted caller reads the public catalog as a visitor). The row is seeded disabled; enabling it is ticket 07.
