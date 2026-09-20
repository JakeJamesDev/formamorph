# 03: Claim and linked-account guards

Status: in-progress
Base: 3a06ed47
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (User Stories › Signing in; Implementation Decisions › Server)

Model rationale: a transaction with overlap rules, a column on an existing table, and guards whose order matters. This is where a second like could leak through.

## What to build

A signed-in request with an Install header performs a **Claim**: the Install's Anonymous Likes become account Likes, and the server links the Install to the account. After that, a signed-out request from the Install is checked against the linked account.

## Acceptance criteria

- [ ] A new table links an Install to the one account that last claimed it. It cascades with the account, so erasure removes it.
- [ ] The Like table gains one nullable column that marks a claimed Like. The claimed Like keeps the time the Anonymous Like was given.
- [ ] Claim runs in one transaction. For each Anonymous Like: insert a claimed Like unless the account already Likes the listing or wrote it; delete the Anonymous Like either way.
- [ ] Claim writes one `like` Signal for the account and upserts the link.
- [ ] Claim is idempotent. A mark that becomes a Like leaves its listing's total unchanged. Each skipped mark (overlap, own listing) lowers that total by exactly one. A second Claim changes no total.
- [ ] Claim sits behind the normal authenticated gate, so an account that has not accepted the Privacy Policy cannot claim.
- [ ] The anonymous route refuses, in the spec's order: linked account suspended; linked account wrote the listing; linked account already Likes the listing (answers liked, not an error).
- [ ] The `like` Signal is written only when the Claim inserted at least one claimed Like. The link upsert runs on every call.
- [ ] The "already Likes" answer is a 200 with its code, `liked: true`, and the count, and stores nothing. A clear press on that listing gets the same answer.
- [ ] The suspended and own-listing guards fire on a like press only. A clear press always removes the Install's own Anonymous Like. Test: suspended linked account with an existing Anonymous Like; the clear succeeds and a new like is refused.
- [ ] Each new refusal code joins the shared codes export that ticket 01 made in the anonymous-likes config.
- [ ] The server repo's `CONTEXT.md` gains **Claim**.
- [ ] The guest `liked` flag is true when the linked account Likes the listing.
- [ ] A token for an account that has not accepted the Privacy Policy is handled as a guest request on the anonymous route.
- [ ] Tests: overlap; own listing; Claim twice; signed-out refusal after a Claim; suspended linked account; erasure removing the link; unchanged totals.
