# 10: Server Linked Image Check

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The server's check for linked (http/https) images in a Supporter-only world reads only `entity.images[].data` and `location.images[].data`. After ticket 03 a world's linked images sit in `worldOverview.mediaList` and galleries hold `{ mediaId }`, so a Supporter-only world could publish linked images the check never sees (Q32).

- The linked-image check also reads every Media List entry whose `data` is an http(s) URL, and still reads embedded gallery values, so both world forms are covered.
- The Media List shape is ticket 01's: entries keyed by id, each `{ id, name, kind, data, hash?, type? }`.
- Must deploy before a client release that contains ticket 03.

## Acceptance criteria

- [ ] A Supporter-only world whose linked image sits only in the Media List is caught.
- [ ] A world with embedded galleries is caught as before.
- [ ] A Media List holding only data URLs passes.
