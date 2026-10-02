# 04: Supporter Field in Author Payloads

Status: ready-for-agent
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
