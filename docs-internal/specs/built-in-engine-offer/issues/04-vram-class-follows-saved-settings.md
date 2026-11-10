# 04: VRAM Class Follows Saved Settings

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: three narrow fixes in code tickets 01 and 03 landed, each with an existing test seam.

**What to build:** the VRAM class always judges the device of the next engine start with the player's saved settings, in AI setup and in the game. The close review found three places where the landed code disagrees with the spec.

1. The shell computes the class from its own copy of the engine settings. That copy holds defaults until the engine is wanted. In AI setup with the engine not yet wanted, a saved manual device, All GPUs, or Backend setting is ignored. Example: a saved pin on an integrated GPU beside a large card answers `ok`, where the spec says `low`.
2. The renderer reads the class once per view. A Device or Backend change in the game does not update the class until the game view remounts, so the card and the AI setup lead can disagree.
3. A device that matches an `nvidia-smi` row is judged by its total before the integrated-name check. No NVIDIA name matches the patterns today, but the spec never trusts a total for an integrated GPU.

- [x] The ask for the VRAM class carries the saved Device and Backend settings, as the device picker's ask carries its pending settings. The shell judges with them, not with its own copy. (`withDeviceSettings` serves both asks; `vramClass.test.ts` "asks the shell with the saved Device and Backend settings")
- [x] With the engine not wanted, a saved pin on an integrated GPU beside a large discrete card answers `low`, and a saved All GPUs setting adds the discrete totals. The test fails when the shell's own copy is used again (run once that way, then restore). (`engineDevice.test.mjs` saved-settings cases; the ask test fails with no argument. The handler itself has no test seam: see Landed.)
- [x] The class is read again when the saved Device or Backend setting changes. The story card and the AI setup lead read the same answer after the change. (`useVramClass` Device and Backend re-read tests; failed once with the deps removed. Both callers use this one hook.)
- [x] The integrated-name check runs before the `nvidia-smi` match. An integrated name with a matching row and a large total answers `low`. The test fails when the order is reversed (run once reversed, then restore). (failed once reversed)
- [x] NVIDIA answers at 8,500 and 8,501 MB are unchanged. (existing boundary test, untouched, green)
- [x] A changelog fragment is added only if a player can see the change. If none is needed, the Landed section says why. (none: see Landed)

For you: none expected. The cases are a saved manual device or backend with the engine not in use.

## Landed

**Not verified**
- The `llm-vram-class` handler in `electron/main.cjs` has no test seam. Its merge is the shared `withDeviceSettings`, which the tests cover, but a revert of the handler to `engineOptions.gpuDevice` would not fail a test. No Electron run was made.
- The story card and the AI setup lead share one hook, `useVramClass`. No test mounts both together.

**Changelog**
No fragment. The card and the AI setup lead for the built-in engine are unreleased, and a fragment always lands as a new entry. The close folds this fix into the existing unreleased entries.

**For you**
- For you: none expected. The cases are a saved manual device or backend with the engine not in use.
