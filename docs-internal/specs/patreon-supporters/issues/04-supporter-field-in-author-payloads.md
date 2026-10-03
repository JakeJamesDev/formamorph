# 04: Supporter Field in Author Payloads

Status: ready-for-human
Status note: Built in FormamorphServer 1a82f91 and 16f1202 (server base f69efa0). The toggle route is `PATCH /api/users/me/patreon` with `{ showFlair: boolean }`. It answers 200 with the status, 400 for a non-boolean, or 409 `PATREON_NOT_LINKED`. The staff rule follows the role the payload shows, per the spec session's ruling. Server suite: 2031 tests green in 25 s.
Base: 19b7b07e
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Rulings Q2, Q8; A4; Implementation Decisions › Author payloads, Account routes)

Model rationale: one rule that must hold on every read path. A missed path shows flair that the member turned off.

## What to build

Every author object carries `supporter`: null, or `{ tier, since }`. `tier` is `supporter` or `supporter_plus`. `since` is the pledge start or null.

The server decides who shows flair. `supporter` is null when the account has no tier, when the account turned the flair off, and when the account is staff.

A linked account can set its **Show Supporter Flair** toggle.

## Acceptance criteria

- [ ] The shared author serializer adds `supporter`. Listings, comments, follows, feedback, and profiles all carry it.
- [ ] `supporter` is null for no link, no tier, toggle off, and any staff role.
- [ ] `supporter` is read live on every path. A lapsed supporter's old feedback reply carries null. Feedback's role snapshot is unchanged.
- [ ] A route sets the caller's flair toggle. It refuses an account with no link.
- [ ] The field is additive. No existing field changes.
- [ ] A route test table runs account state (no link, no tier, Supporter, Supporter+, toggle off, staff supporter) against each payload path.
- [ ] Each guard bites. Removing the staff rule or the toggle rule makes a test fail.
- [ ] Server gates green.
