# 04: Server Falls Back On An Undecodable Image

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Repo: FormamorphServer

## What to build

Close review gap. An image whose header looks valid but whose body fails to decode must count as ineligible, as the spec's eligibility rule says ("decodable"). Today the server checks only the header. When marking then fails, that entity gets no mark and the next entity takes the slot.

- A picked image that fails to decode falls back to the approximation for that entity, as any failed pick check does.
- An approximated image that fails to decode skips that character, as any ineligible approximated image does (ticket 01 ruling).
- The backdrop fill already moves to the next candidate when one fails to decode; keep that.

## Acceptance criteria

- [ ] A valid pick whose body does not decode: the entity is marked through the approximation, read back with the watermark reader.
- [ ] An approximated image whose body does not decode: that character is skipped and the next character takes the mark.
- [ ] Each test fails when the header-only check is reinstated.
