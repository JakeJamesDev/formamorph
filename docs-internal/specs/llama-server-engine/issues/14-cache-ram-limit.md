# 14: Cache RAM Limit

Status: wontfix
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one server argument and its test, once the value is chosen.

## What to build

The engine passes `--cache-ram` so a load doesn't reserve the server's default 8 GB of host RAM for prompt cache (spec: Settings → server arguments, "Prompt cache: slot prompt reuse on, `--cache-ram` set low"). Found by the close review: `serverArgs` never passes it.

Ruled wontfix (T14): LM Studio keeps the server default of 8192 MiB, and so do we.

## Acceptance criteria

- [ ] `serverArgs` passes `--cache-ram` with the chosen value on every start, and an engine test checks it.
- [ ] The guard is proven to bite: with the argument removed, the test fails.
- [ ] Slot prompt reuse stays on.
