# 06: Close Review Fixes

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Four small items from the close review of tickets 01–05. Each is in code those tickets wrote.

## What to build

The effort's last gaps close, so the spec can close (spec, Library and seeding; World Editor pickers).

- **Stale Default mark.** The one-time mark step treats a stored Default Avatar that the library no longer holds as not marked. It then marks the bundled Avatar when the library still holds it. A Default Avatar the library holds is unchanged.
- **World-row hint.** A world stat or trait with no Avatar shows a hint that fits a world row. It does not name the Profile tab, which only an entity has. It covers both causes: every playable persona has None, and the personas use User's Default while the author's library is empty. Read the Writing Guide before you write it. The owned-row hint is unchanged.
- **World-trait hint test.** A test covers the hint on a world trait, beside the existing tests for an owned stat, a world stat and an owned trait.
- **Entity View mounts once.** `GameViewer.panelRails.test.tsx`, "the Entity View model loads once…", failed in the full suite under load (2 mounts, expected 1) and passed alone. Find the cause before you change anything: the loader state from ticket 01 can resolve after the test reads its count. If the view mounts the viewer twice for one Avatar, fix the view. If only the test reads the count too early, make it wait for the resolved state. Do not weaken the assertion.

## Acceptance criteria

- [x] An existing install whose stored Default Avatar is gone, with the bundled Avatar present, gets the bundled Avatar marked once. (`marks the bundled Avatar once when the stored Default Avatar is gone from the library`)
- [x] An existing install whose stored Default Avatar is in the library keeps it. (existing `keeps a Default Avatar the player marked before the update`)
- [x] Mutation: make a stale id count as marked again, and the stale-mark test fails. (ran it: 1 failed, then restored)
- [x] A world stat and a world trait with no Avatar show the world-row hint, and the text does not name the Profile tab. (StatManager and TraitManager tests)
- [x] An owned row with no Avatar and no 3D model shows the owned-row hint, as before. (existing owned tests)
- [x] The world-trait hint has a test. (`shows the world-row hint, not the Profile tab hint…`)
- [x] The Entity View test passes in the full suite. The ticket states the cause it found. (Passed in a 77-file run of `src/components/game` and the touched tests; the full suite runs in prepare.)

For you: read the world-row hint text.

## Landed

Cause of the Entity View failure: a real view bug, not a test race. `useVrmSourceUrl` started with `resolving` false, so `EntityAvatar` mounted an empty viewer on the first render and a second one once the Avatar loaded. The test read its count between the two mounts under load. The hook now derives `resolving` from the last settled load, so the loader holds from the first render. The test now waits for exactly one mount.

**Not verified**
- The full-suite run of the Entity View test under load: prepare runs the full gates once.

**For you**
- Read the world-row hint: `WORLD_NO_MODEL_HINT` in [useSliderPicker.ts](src/lib/useSliderPicker.ts:12), shown under a world stat's or trait's Appearance tab when no playable persona has an Avatar.
