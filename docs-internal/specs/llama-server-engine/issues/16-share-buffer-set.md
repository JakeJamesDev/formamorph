# 16: Share Buffer Set

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one parser condition or one ruling line, once the user picks which.

## What to build

The Formamorph share and ruling T04-3 count the same buffers. Found by the close review: T04-3 lists the model, KV and compute buffers (and RS for hybrid models), but the parser also adds non-host output buffers. The difference was about 0.5 MiB in the measured runs.

Ruled (T16): keep the output buffer in the sum; T04-3 now names it. This ticket adds the test only.

## Acceptance criteria

- [x] The parser and T04-3 name the same buffer set. `BUFFER_SIZE` lists model, KV, RS, compute, output; T04-3 names the same five (host buffers excluded).
- [x] A test against the recorded fixtures checks the chosen set. `memoryTally` tests: "leaves out the recorded output buffers" (all four recorded lines are host) and "counts a non-host output buffer" (synthetic line in llama.cpp's format; fails when `output` leaves the regex).

## Landed

**Not verified:** none.

**For you:** none.

The recorded fixtures hold no on-device output buffer, so the non-host case uses one synthetic line. The review's ~0.5 MiB gap was not in the recorded runs.
