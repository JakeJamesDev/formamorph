# 07: Regenerates As Foreground Queue Jobs

Status: done
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: two UI entry points move from a disabled state to a cancelable wait on an existing queue; the queue rules are already built and tested.

## What to build

Regenerate Memory in the Memory Manager and the discovered-character regenerate enter the Background Pass Queue as foreground jobs. A press shows a spinner with a cancel, waits behind running passes, then holds the queue while it runs. Cancel while waiting removes the job; cancel while running aborts the request. Both carry the queue's abort signal, so leaving the game or loading a save stops them too.

Today the discovered-character button is disabled while silent passes run, and the Memory Manager button only during a turn; both change to the waiting spinner. The discovered-character busy check that read three pass flags and the scene render becomes the queue's waiting state. Partial re-rolls stay outside, gated by the turn flag as today.

Changelog fragment, Minor → Fixed → 👤: Regenerate Memory and the character description regenerate wait for background passes with a cancelable spinner instead of being unavailable or racing them.

## Acceptance criteria

- [ ] Queue unit tests: a regenerate waits behind running passes, can be canceled while waiting, holds the queue while it runs, and is aborted on unmount and load.
- [ ] Mounted tests show the waiting spinner and its cancel on both surfaces.
- [ ] In the running app, pressing Regenerate Memory during a backfill waits, then runs; cancel returns the row to idle.
- [ ] Copy sweep on the two surfaces.
- [ ] Four gates green.
