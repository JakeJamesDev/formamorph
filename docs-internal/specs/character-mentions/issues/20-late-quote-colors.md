# 20: Late Quote Colors

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Spec Q74 (2): a quote that is already on screen when its streamed color arrives takes that color at once, with the 300 ms fade.

- **When it happens:** the player skips the reveal, or a hold reaches `QUOTE_HOLD_MAX_MS` and the quote shows uncolored. Today the visible block doesn't redraw for the color, so it waits for the next remount or for narration to end (ticket 18's Landed notes).
- **The change:** the live narration block picks up each color as its run finishes, with no remount. The full-turn reading at narration end still wins, as Q72 says.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [x] After a skip, each quote takes its color when its run finishes, before narration ends. The test is proved by reinstating the wait. (`lateQuoteColors.test.tsx` "colors a quote already on screen"; red with the renderer subscription disabled, green restored.)
- [x] After a hold cap, the uncolored quote takes its color when the late run finishes. (Same renderer path as a skip: the block is drawn with the quote pending, then painted in place.)
- [ ] A color change plays the 300 ms fade, never a jump. The full-turn recolor at narration end still works. (The span gets `data-quote-recolor` and `--quote-from`, which the existing `quote-recolor` keyframe animates; full-turn recolor tests in `quoteSpeakers.test.ts` stay green. The fade itself is not sampled in a browser.)
- [ ] Frames of one quote before and after its late color, in light and dark, for the user.

## Landed

**Not verified**
- 300 ms fade in a real browser: only the attribute and variables are asserted.
- Frames before and after the late color, light and dark: not captured.
- A late-painted quote that the full-turn reading then recolors: the paint drops `data-quote-recolor` on `animationend` so the second fade can start, but no test runs the reading after a paint.
- The paint on subscribe (a run ending between render and effect): no test; the effect flushes inside `act`.
- Hold-cap through the real pacer into the renderer: the two halves are tested apart (`streamingQuotes.reveal.test.ts` for the cap, `lateQuoteColors.test.tsx` for the paint).

**For you**
- Skip a reveal on a turn with quotes while the model is still reading: each quote should fade into its color as its run ends, before narration finishes.
- Same during a hold that reaches its cap.
- The quote's card trigger (click to open the speaker) stays as it was until the full-turn reading lands.

**Shape notes**
- The reader now lists a quote (speaker null) once its hold point arrives, so the rendered span carries its `data-quote-span` key. `LiveQuotes` and `QuoteSpeakerSource` gain an optional `subscribe`.
