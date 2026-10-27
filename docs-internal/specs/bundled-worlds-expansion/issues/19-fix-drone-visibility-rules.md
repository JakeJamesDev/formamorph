# 19: Fix Drone Visibility Rules

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q18; Implementation Decisions › Visibility rules, ticket 12 finding)

## What to build

In play the backdrop and the Map show the first visible image, so Drone's two Visibility rules never show: Mossback Hill's awake Sentinel and the drone's Overdrive image both sit in slot 1 behind an unruled slot 0. After this ticket, a player whose Charge reaches 100 percent sees the Sentinel wake on Mossback Hill and the drone's gallery lead with its Overdrive image.

- Give slot 0 of each the complementary rule: Charge below 100 percent on slot 0, Charge at 100 percent on slot 1, with the same owner each pair has today. No new images.
- Preserve every other byte of the world file. Regenerate the fingerprints.
- Per-world tests cover each pair at a Charge value on both sides of the threshold and are shown to bite.

## Acceptance criteria

- [x] Both Drone pairs have complementary rules, and the stripped diff shows only the two rules and the fingerprints. Diff is the two `requires` blocks plus a comma on each `data` line; `bundledFingerprints.json` is unchanged because the fingerprint hashes only strings of 40+ characters.
- [x] A test reads Mossback Hill's visible backdrop and the drone's visible gallery at Charge 99 percent and at 100 percent and sees the swap, and fails with either rule removed. `droneWorld.test.ts` › the drone's Visibility rules; each test failed with its slot 0 rule deleted.
- [x] The shared suite is green, the Test Bench accepts both pairs, and no probe is needed since no AI text changed. `bundledWorlds.test.ts` drone cases pass; prepare runs the full suite.

## Landed

**Not verified**
- None.

**For you**
- In play, raise Charge to 100 percent on Mossback Hill and watch the backdrop change.
