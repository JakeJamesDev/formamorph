# 05: Client Sends the Full Contribution

Status: ready-for-agent
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A contribution carries everything a reviewer or a replay needs:

- **Player id:** the persona's entity id.
- **Cast snapshot:** every entity in the reading's cast, persona included, with id, name, aliases, stranger name and kind. Names are placeholder-resolved, as they are today.
- **Quotes:** each quote's shown speaker, with its rule and spans from 01.
- **Versions:** the client version and the reading version.

**Saves keep the quote records.** Ticket 01 added `rule`, `mention` and `firstPerson` to each quote, but saves keep only start, end and speaker: restore and correction drop the rest. This ticket owns persisting them, so a turn sent after a reload sends what it showed. Ticket 03 reads them from saved turns too. A turn saved before this change restores with the fields absent.

The client leaves out any value the server would refuse, so the send still goes through, as it already does for `entityNames`. A turn that was read before this change sends what it has.

## Acceptance criteria

- [ ] The contribution body for a read turn holds `playerId`, `cast`, `quotes`, `clientVersion` and `readingVersion`.
- [ ] Each quote record's speaker equals the speaker that the turn showed.
- [ ] A name or alias over the server's bound is left out, and the send still goes through.
- [ ] A turn without a persona sends `playerId` as null.
- [ ] After a save and reload, and after a correction, each quote keeps its `rule`, `mention` and `firstPerson`.
- [ ] A turn saved before this change restores and sends without those fields.
