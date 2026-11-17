# 10: Server Linked Image Check

Status: done
Base: 23b7ecb
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

- [x] A Supporter-only world whose linked image sits only in the Media List is caught. `supporterWorld.test.js` › refuses a linked image that sits only in the list.
- [x] A world with embedded galleries is caught as before. Existing `supporterWorld.test.js` and `supporterEndDate.test.js` cases pass.
- [x] A Media List holding only data URLs passes. `supporterWorld.test.js` › accepts a list that holds only data URLs.

## Landed

Per spec Q44, the check also flags linked sounds in the list (`Media List sound "<name>"`), used or not. The refusal copy says "images or sounds".

**Not verified**
- The gated Supporter route that processes embedded images was not checked for image data inside the Media List. It may need its own ticket.

**For you**
- Deploy this before the client release that holds ticket 03, then raise the client minimum (spec release steps).
