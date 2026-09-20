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
- [ ] The catalog refreshes after a Claim, so hearts and counts are current.
- [ ] A failed Claim never blocks or delays sign-in. It retries on the next session change.
- [ ] No Claim call is made when the Install id does not exist yet.
- [ ] After sign-out, a listing the account Likes shows a filled heart and a press does not raise the count.
- [ ] Tests over mocked fetch: Claim on each session event; failure does not block; no call without an Install.
- [ ] Four gates green.
