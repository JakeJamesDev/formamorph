# 05: Quote Repaint on a Color Change

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

When a new speaker becomes visible mid-turn, the narration remounts once and that speaker's quotes take their color (Q8, user story 5). Today the remount happens but the quote stays uncolored.

The renderer's markdown library caches its processor under the plugin's name plus the JSON of its options. The quote plugin's options hold the speaker source, whose colors and recolor are Maps, and a Map serializes as `{}`. So a color change keeps the same key and reuses the processor built with the old colors.

- The speaker source serializes to everything the quote plugin reads: the text, the quote spans, the color entries and the recolor entries. Every source, live and committed, does this from one place.
- The renderer and its plugin keying stay as they are.
- The live source already serializes its growing text and quotes, so this adds no new processor churn while a turn streams.

## Acceptance criteria

- [ ] Two speaker sources with the same text and quotes but different colors serialize differently; the same content serializes the same.
- [ ] A recolor change also changes the serialized form.
- [ ] In the game viewer render harness, a newly visible speaker's quote carries its speaker after the remount. Extend ticket 02's harness case.
- [ ] Removing the serializer makes that harness test fail.
- [ ] Existing quote speaker and late quote color tests pass unchanged.

For you:
- Play a turn where a new character starts speaking mid-turn with Character Mentions on: their quotes take their color.
