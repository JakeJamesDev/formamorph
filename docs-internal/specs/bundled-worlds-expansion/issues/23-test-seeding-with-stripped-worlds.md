# 23: Test Seeding With Stripped Worlds

Status: done
Blocked by: 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q22; Testing Decisions)

## What to build

Tests that mount the Main Menu no longer parse every lossless bundled world. Ticket 11 found that the seeder reads every world under the bundled folder on each mount, and with Emberwatch at 54 MB beside Rampage at 55 MB and Drone at 40 MB, one Main Menu test peaked at 3,160 MB of heap and two of its tests ran 10 to 12 times slower, until ticket 11 raised the vitest worker heap as a stopgap.

- Give tests that mount the Main Menu an image-stripped copy of the bundled worlds: a test-only alias or mock for the bundled-world glob the seeder reads, built from the source files with every image replaced by a short placeholder, the same stripping the `bundled-worlds` skill's tool does. Ids, text, rules and fingerprints of the stripped form are whatever the test needs; the seeder's hash check must still behave as in production, so decide whether the stripped copies carry their own fingerprints or the seeder is told it is under test.
- The per-world tests and the shared suite keep reading the source files through `?raw`, unaffected.
- Remove the worker heap stopgap from the vitest config and show the Main Menu test runs within the default heap again, with its two slow tests back near their earlier times. Report the before and after numbers.

## Acceptance criteria

- [x] The Main Menu tests run with the default worker heap, and the age-gate test's peak heap and the two slow tests' times are in this ticket's comments beside ticket 11's numbers. (Heap-sampling preload on every process; table below.)
- [x] A test proves the mocked seeder still seeds every bundled world id and still skips a world the player deleted. (`WorldStorageService.strippedSeed.test.ts`; it also checks the stored Valentines holds markers and no `data:` URI, and went red when the plugin passed Valentines unstripped.)
- [x] The shared suite and the per-world tests read the source files unchanged, and the full test run is green. (The plugin skips `.test.` importers; the same test asserts its own `?raw` import keeps `data:image/`. Full suite: prepare's gate, which the `vite.config.js` change forces to run in full.)
- [x] The stopgap heap setting is gone from the vitest config. (Both: the fork `execArgv` in `vite.config.js` and the main-process flag in `scripts/runTests.mjs`.)

## Landed

**Not verified:** nothing.

**For you:** nothing; the change is test-only.

## Comments

**Mechanism.** `scripts/stripSeededWorlds.mjs` is a Vite plugin active under vitest only. Its `resolveId` sends an app module's `defaultworlds/<id>.json?raw` import (today the seeder's glob in `WorldStorageService.ts`) to a `?raw&stripped` id, whose `load` returns the world with every `data:` URI replaced by the strip-worlds marker (`stripValue`, now exported from `scripts/stripWorldImages.mjs`). Test files keep the source bytes. The seeder hashes the text it loads, so the stripped copy carries its own hash and the check behaves as in production (spec session Q2). The seeder-cost session moves the glob to `src/lib/bundledWorldSources.ts`; the plugin keys on any non-test importer, so that move needs no change here.

**Numbers.** `MainMenu.ageGate.test.tsx` run alone, same machine, heap sampled every 25 ms in every process.

| | Ticket 11, no stopgap | Before (8 GB stopgap) | After (default heap) |
|---|---|---|---|
| Fork heap peak | 3,160 MB | 5,948 MB | 400 MB |
| Main process heap peak | died at 4 GB in prepare | 1,393 MB | 613 MB |
| "drops an explicit answer when the login dialog is canceled" | 10.9 s | 0.3 s | 0.5 s |
| "cannot finish the login callback for an account replaced during persistence" | 7.8 s | 0.2 s | 0.2 s |
| First test, which pays the seeding ("does not carry a signup answer...") | n/a | 21.6 s | 0.6 s |
| Tests total / file wall | n/a | 34.3 s / 58.6 s | 10.5 s / 31.1 s |

The main-process flag is not needed: the main process peaked at 613 MB alone and 1,180 MB with the stripped-seed test beside it. With the plugin off and the default heap, the stripped-seed test dies with a V8 heap failure, so a future importer change cannot reload the full files silently.
