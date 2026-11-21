# 08: Start Gate Reads

Status: done
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A Condition checked at the start of a story reads the story's start weather and start time. The spec covers this in Q31.

- **New Game settle.** The first trait settle and the turn-one sandbox read the resolved start: the drawn Opening's Weather, then Default Weather, then Clear, and the drawn Opening's Time, then Default Time, then the shipped start hour. Today the gate reads Clear and a fixed hour, and the sandbox reads Default Weather while ignoring the Opening.
- **Unset weather.** When nothing is authored, the start weather is unset until the page-one Weather Pass reads it. The first settle reads Clear then, and the turn-one commit settles again with the read weather.
- **Library entity editor and Enter World.** These read Default Weather and Default Time, as the World Editor does. With neither set, Clear and the shipped start hour.
- **Redraw.** A page-one redraw onto another Opening settles again from the new start.

## Acceptance criteria

- [x] A New Game on an Opening with Weather Rain holds a trait gated on Rain from the first settle. With Opening Time night, a trait gated on night holds too. (`openingState.start.test.ts`, first block; the GameViewer second settle is not driven by a test)
- [x] With no Opening Weather or Time, the first settle reads Default Weather and Default Time. (same file, "reads Default Weather and Default Time")
- [x] The library entity editor and Enter World read Default Weather and Default Time. (same file, `entryGateInput` and `libraryGateInput` tests)
- [x] A redraw onto an Opening with other weather changes the first settle's result. (rain versus snow fold; the `handleRegenerate` call is not driven by a test)
- [x] Each guard bites when its bug returns. (Putting back the fixed-hour gate failed the two time tests; a re-draw without replayed ids fails the id test.)
- [x] Changelog fragment written, only if a released behavior changes. None: Weather and Opening Time are unreleased.

## Landed

**Not verified**
- The GameViewer wiring (`settleStartUnder` after the draw and after a redraw) has no test and no browser check. It is in a 7000-line view behind many contexts.
- The turn-one re-settle with the page-one read weather relies on the existing per-turn settle, which reads state weather. No test here covers it.
- The start log keeps the first fold's lines. A weather-dependent item effect log line could differ in the second fold.

**For you**
- New Game on a world with an Opening set to Rain or night: a trait gated on it should hold from turn one. Redraw page one onto an Opening with other weather: the trait should flip.
- The World Editor trait stores now also read Default Time (before, only Default Weather). The ticket said they already did.
