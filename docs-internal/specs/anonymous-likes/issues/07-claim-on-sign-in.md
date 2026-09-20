# 07: Claim on sign-in

Status: ready-for-agent
Blocked by: 03, 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (User Stories › Signing in)

Model rationale: one subscriber on an existing seam with four examples beside it.

## What to build

After a guest signs in, signs up, or adopts a session, the likes given on this Install appear as the account's Likes. Hearts stay filled through the change.

## Acceptance criteria

- [ ] The session-change seam calls Claim with the Install header after sign-in, sign-up, and an adopted session.
- [ ] Server contract (commit `7b0b65f`): an authenticated POST with no body, the Install in the same header the guest route reads, answering `{ claimed }` = the marks that became Likes. A Claim that moves nothing is the ordinary case. 400 `install_header_invalid` for a bad header. Read the path and header name from the server repo.
- [ ] The Claim is not gated by the server setting, so call it even when `anonymousLikes` is false.
- [ ] Linked-account codes: `anonymous_likes_linked_suspended` and `anonymous_likes_linked_own_listing` are 403; `anonymous_likes_linked_already_liked` is the 200.
- [ ] The catalog refreshes after a Claim, so hearts and counts are current.
- [ ] A failed Claim never blocks or delays sign-in. It retries on the next session change.
- [ ] No Claim call is made when the Install id does not exist yet.
- [ ] After sign-out, a listing the account Likes shows a filled heart and a press does not raise the count.
- [ ] The server answers that press with a 200 that carries a code and `liked: true`. The heart stays filled on a like press and on a clear press, with no error toast.
- [ ] Tests over mocked fetch: Claim on each session event; failure does not block; no call without an Install.
- [ ] Four gates green.
