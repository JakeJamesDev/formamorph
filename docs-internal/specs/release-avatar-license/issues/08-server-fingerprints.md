# 08: Server Fingerprints

Status: ready-for-agent
Blocked by: 04, 05
Repo: FormamorphServer
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

A copy of a generated list, with its existing test as the guard.

## What to build

The server recognizes the unedited Sei, Aki and Praline files as bundled, and refuses to publish them as community Avatars. The client's generated fingerprint list is copied to the server. Elaina's hash stays in the list.

Rulings: Q4, Q7.

## Acceptance criteria

- [ ] The server's avatar list equals the client's, compared by test or by a recorded diff.
- [ ] A test refuses each of the three new hashes and passes an edited file.
- [ ] Elaina's hash is still refused.

For you: deploy the server before the first release that carries these tickets.
