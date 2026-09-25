# 05: Server: refuse the default Avatar

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: the route already decodes the VRM bytes. This hashes them against a list that ticket 04 already loads.

Workplace: the FormamorphServer repo.

## What to build

A player on any client publishes the default Avatar, from either build. The server refuses with a 400 and the message "This is the default avatar. Upload your own VRM." Any other permissive VRM is accepted as today.

## Acceptance criteria

- [ ] The model publish path hashes the decoded VRM bytes and checks the Avatar hash set, before the license gate.
- [ ] Route tests: a VRM whose hash is in a test list is refused, and the existing GLB fixture still passes.
- [ ] Each guard is proven to bite. Server test suite green.
