# 13: The catalog survives a server that refuses the Install header

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Further Notes › Rollout order)

Model rationale: one fallback in the storage service and one capability check, with tests over mocked fetch.

## What to build

A server that does not list the Install header in its CORS allow list refuses the preflight, and the whole catalog fails for every guest, not only the heart. Ticket 06 found this against the live server before the server deploy. The rollout order prevents it only when nobody gets the order wrong.

A guest always sees the catalog. Against such a server the guest loses only the like.

## Acceptance criteria

- [ ] When a guest catalog, detail, or like request that carries the Install header fails at the network layer, the client retries once without the header.
- [ ] When the retry succeeds, the client stops sending the header for the rest of the session and treats `anonymousLikes` as off.
- [ ] When the retry also fails, the failure surfaces as it does today. A real offline state costs one extra request, no more.
- [ ] A signed-in session is unchanged; it never sent the header.
- [ ] The website never sends the Install header, because its guest-likes capability is off. Check what ticket 06 built and fix it if the website sends it.
- [ ] Tests over mocked fetch: header refused then retry succeeds; both fail; the header stays off for the session; the website sends no header.
- [ ] Changelog: no entry. This guards unreleased work.
- [ ] Four gates green. State the test run time.
