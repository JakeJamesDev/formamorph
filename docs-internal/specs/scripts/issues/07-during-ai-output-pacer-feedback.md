# 07: During AI Output Pacer Feedback

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the reveal pacer reports its release index back to the stream, and the smooth crawl changes behavior only when a script exists.

## What to build

`narration.sent` holds the sentences the reveal has released to the screen, and `narration.buffered` the complete sentences the pacer still holds (Q20). The pacer publishes its release index through its store, as it publishes cadence today. With the reveal off, `buffered` is empty and `sent` is every prior sentence. When the world has a During AI Output script, the smooth crawl shows complete sentences only, as the fade reveal does; worlds without one keep today's crawl (Q21).

Spec: Q20, Q21.

## Acceptance criteria

- [ ] With the fade reveal on, a script on sentence 3 reads `sent` and `buffered` that match the pacer's release index at that moment; a test drives the pacer
- [ ] With the reveal off, `buffered` is empty and `sent` holds every earlier sentence
- [ ] With a During AI Output script present, the crawl never shows an incomplete sentence; without one, the crawl is byte-identical to today
- [ ] Four gates green

## Blocked by

- 06

## Comments

Handoff from ticket 06 (landed as b3b85d9858): the narration stream's `sentence` event carries `full`; the rewrite queue in `src/lib/aiRequest/narrationRewrite.ts` passes `SentenceAt { index, full }`. `narration.sent` and `narration.buffered` are not set yet: add them to `NarrationInput` and the `narration` prelude in `src/lib/statCodeExecutor.ts`. The output-timing `player` stub is `OUTPUT_PLAYER` there; ticket 09 keeps its throw text.
