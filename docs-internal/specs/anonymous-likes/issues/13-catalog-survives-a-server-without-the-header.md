# 13: The catalog survives a server that refuses the Install header

Status: ready-for-human
Base: 1745a81f
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

- [x] When a guest catalog, detail, or like request that carries the Install header fails at the network layer, the client retries once without the header.
- [x] When the retry succeeds, the client stops sending the header for the rest of the session and treats `anonymousLikes` as off.
- [x] When the retry also fails, the failure surfaces as it does today. A real offline state costs one extra request, no more.
- [x] A signed-in session is unchanged; it never sent the header.
- [x] The website never sends the Install header, because its guest-likes capability is off. Check what ticket 06 built and fix it if the website sends it.
- [x] Tests over mocked fetch: header refused then retry succeeds; both fail; the header stays off for the session; the website sends no header.
- [x] Changelog: no entry. This guards unreleased work.
- [x] Four gates green. State the test run time.

## Comments

The fallback is one private helper in the storage service, `installFallbackFetch`, which every request that can carry the Install header goes through: the catalog, both listing reads, and the press. It retries without the header only after a network-layer throw, and records the refusal only when the second ask answers, so a dead network costs one extra request and no hearts.

Whether a request may name an Install is one decision, held in `anonymousLikes.ts` and read through `readerInstallId()`. Two things turn it off: the shell (the host states it from `capabilities.guestLikes`, so the website names none and stores none) and a server that refused the header once. While it is off, every response reads `anonymousLikes` as false, the Claim asks nothing, and the catalog cache tag names the one guest rather than an Install.

Ticket 06 did send the header from the website: `readerHeaders()` keyed off the session alone, and the website catalog runs through the same service. That is what the capability now gates.

Review findings folded in as a second commit:

- The retry recorded the refusal on any answer. A 500 on the second ask says the server is having a bad minute, not that it refuses the header, so only an answer below 500 now records one.
- The browser named its catalog reader with a raw `installId()` of its own, so the website stored an id even while sending no header. Both callers now go through `readerKey` in the Install module, which answers `guest` where nothing may name an Install.
- The capability statement moved from the host to `CommunityCreationsBrowser`, which is the component that owns `capabilities` and drives the catalog, so a shell that mounts the browser directly is covered too.

Two notes for whoever reads this next:

- The first commit swept another session's in-flight staff-likes work in `WorldStorageService.ts` into itself, because `git add` on a shared file takes the whole file. It is not ticket 13 work and its types live in `src/types/users.ts`, still uncommitted, so that commit does not typecheck standalone. It was not rewritten: another session had already committed on top, and rewriting under live parallel sessions cost more than it saved.
- Four gates run on the finished unit: typecheck 0 errors, lint 0 errors (1 pre-existing warning elsewhere), build succeeds, and 12 097 tests pass in 154 s.
