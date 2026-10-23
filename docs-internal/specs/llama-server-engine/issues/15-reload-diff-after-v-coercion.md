# 15: Reload Diff After V Coercion

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one comparison in the panel, with the coercion rule shared rather than copied.

## What to build

Save & Reload turns off once the loaded model matches what the player asked for, even when main coerced their V Cache Type (ruling T06-2). Found by the close review: with a stored quantized V cache and Flash Attention off, main loads F16, but the panel's reload diff compares the stored `q8_0` against the applied `f16`, so Save & Reload stays enabled forever.

The panel compares against the value main would apply, using the same coercion rule, not a second copy of it.

## Acceptance criteria

- [ ] A panel test: stored V `q8_0` with Flash Attention off and an engine that applied `f16` shows Save & Reload disabled.
- [ ] The guard is proven to bite: with the old comparison back, the test fails.
- [ ] Main and the panel read one coercion rule.
