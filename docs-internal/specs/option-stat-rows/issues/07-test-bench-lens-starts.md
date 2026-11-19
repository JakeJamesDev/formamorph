# 07: Test Bench Lens Starts

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Ticket 04 found that the Test Bench lens pin plan seeds entity stats without Option or trait starts, and that its global stats leave out the cast's default global rows. The Bench's opening fold is already right. The lens must seed stats through the same opening steps (spec Q27, Q29), with the author's picked Option values.

## Acceptance criteria

- [x] In the Test Bench lens, with Easy giving the Dragon "Health starting +20", a stat-band Pin on the Dragon resolves from the raised value. (`lens.starts.test.ts`, "pins a stat band from the value the picked Option row raises")
- [x] An entity's default trait start reaches the lens's entity stats. ("applies an entity's default trait start to its stats")
- [x] A cast entity's default global row reaches the lens's global stats. ("applies a cast entity's default global row to the global stats")
- [x] Each guard goes red with its bug reinstated. (old `lens.ts` restored: all 4 tests failed)

## Landed

**Not verified**
- None.

**For you**
- Open the Test Bench with an Option row on an entity's starting stat and a stat band near the threshold: the band's Pin should follow the picked Option value.
- Adjacent, not fixed: `lensStatTraits` passes only the persona's picks, so a cast entity's default toggle rows may not reach `statEnabled`.
