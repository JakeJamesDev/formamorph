# 16: Share Buffer Set

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one parser condition or one ruling line, once the user picks which.

## What to build

The Formamorph share and ruling T04-3 count the same buffers. Found by the close review: T04-3 lists the model, KV and compute buffers (and RS for hybrid models), but the parser also adds non-host output buffers. The difference was about 0.5 MiB in the measured runs.

Ruled (T16): keep the output buffer in the sum; T04-3 now names it. This ticket adds the test only.

## Acceptance criteria

- [ ] The parser and T04-3 name the same buffer set.
- [ ] A test against the recorded fixtures checks the chosen set.
