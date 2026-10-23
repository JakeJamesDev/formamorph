# 15: Reload Diff After V Coercion

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one comparison in the panel, with the coercion rule shared rather than copied.

## What to build

Save & Reload turns off once the loaded model matches what the player asked for, even when main coerced their V Cache Type (ruling T06-2). Found by the close review: with a stored quantized V cache and Flash Attention off, main loads F16, but the panel's reload diff compares the stored `q8_0` against the applied `f16`, so Save & Reload stays enabled forever.

The panel compares against the value main would apply, using the same coercion rule, not a second copy of it.

## Acceptance criteria

- [x] A panel test: stored V `q8_0` with Flash Attention off and an engine that applied `f16` shows Save & Reload disabled. (`stay disarmed when main coerced a stored quantized V…` in `LocalModelPanel.test.tsx`)
- [x] The guard is proven to bite: with the old comparison back, the test fails. (ran it: 1 failed, 23 passed)
- [x] Main and the panel read one coercion rule. (`electron/cacheTypes.cjs`; `llamaServer.cjs` re-exports it)

## Landed

First renderer import from `electron/`. Vite serves a `.cjs` raw in dev, so `vite.config.js` has a small `cache-types-cjs` plugin that wraps that one file as an ES module. The build resolves it unchanged.

**Not verified**
- Dev server in a browser: I checked the transformed module by importing it in Node, not by loading the page.
- Packaging: I did not check that electron-builder ships `electron/cacheTypes.cjs`.

**For you**
- Local Model panel, Advanced: with a stored Q8_0 V Cache Type and Flash Attention off (the panel blocks making this pair, so use stale settings), Save & Reload stays off after a load.
- No changelog fragment: the fix is for an unreleased feature.
