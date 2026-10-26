# 23: Test Seeding With Stripped Worlds

Status: ready-for-agent
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

- [ ] The Main Menu tests run with the default worker heap, and the age-gate test's peak heap and the two slow tests' times are in this ticket's comments beside ticket 11's numbers.
- [ ] A test proves the mocked seeder still seeds every bundled world id and still skips a world the player deleted.
- [ ] The shared suite and the per-world tests read the source files unchanged, and the full test run is green.
- [ ] The stopgap heap setting is gone from the vitest config.
