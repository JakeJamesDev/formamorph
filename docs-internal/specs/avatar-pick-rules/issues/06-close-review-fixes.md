# 06: Close Review Fixes

Status: ready-for-agent
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

- [ ] An existing install whose stored Default Avatar is gone, with the bundled Avatar present, gets the bundled Avatar marked once.
- [ ] An existing install whose stored Default Avatar is in the library keeps it.
- [ ] Mutation: make a stale id count as marked again, and the stale-mark test fails.
- [ ] A world stat and a world trait with no Avatar show the world-row hint, and the text does not name the Profile tab.
- [ ] An owned row with no Avatar and no 3D model shows the owned-row hint, as before.
- [ ] The world-trait hint has a test.
- [ ] The Entity View test passes in the full suite. The ticket states the cause it found.

For you: read the world-row hint text.
