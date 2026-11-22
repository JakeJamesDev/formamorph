# 05: Client Sends the Full Contribution

Status: done
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

- [x] The contribution body for a read turn holds `playerId`, `cast`, `quotes`, `clientVersion` and `readingVersion`. (`posts once with the full passage...`, `sends the reading version the turn was read at`)
- [x] Each quote record's speaker equals the speaker that the turn showed. The record holds the reading's own speaker, ahead of any correction, as the spec session ruled. (`holds the speaker the reading showed...`)
- [x] A name or alias over the server's bound is left out, and the send still goes through. (`leaves out an alias or stranger name over the bound...`, `leaves out a span the server would refuse...`)
- [x] A turn without a persona sends `playerId` as null. (`sends playerId as null without a persona...`)
- [x] After a save and reload, and after a correction, each quote keeps its `rule`, `mention` and `firstPerson`. (`restores each quote's rule...`, `keeps a corrected quote's rule...`; the correction mutation turned it red)
- [x] A turn saved before this change restores and sends without those fields. (`restores a quote saved before the records came without them`, `sends a turn read before the records...`)

## Landed

**Not verified**
- No send went to a running server. The body follows ticket 04's wire shape and its validators, read from `FormamorphServer/src/utils/corefCorpus.js`.
- A cast entity whose resolved name is empty or over 200 characters is left out of `cast` whole, because the server requires a non-empty name per record. Aliases and the stranger name are left out singly.
- Mutation checks ran on the record-keeping in `correctReading` and on the quote span guard only.

**For you**
- Save shape grew, additively: each saved turn reading may hold `readingVersion` and `castIds`, and each saved quote `rule`, `mention`, `firstPerson` and `fallback`. Older saves restore without them.
- The send body for `Contribute Corrections` grew by `playerId`, `cast`, `quotes`, `clientVersion` and `readingVersion`. A send from a real turn against the staging server is the check only a player can make.
