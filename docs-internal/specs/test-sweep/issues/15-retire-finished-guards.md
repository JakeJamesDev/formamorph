# 15: Retire Finished Guards

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: Needs release-state proof per guard and care around Q5 parity.

Parent: [Test Sweep spec](../spec.md)

## What to build

Rename guards and parity suites retire when their change is released, except parity that still pins Q5 behavior (Q11). Prove released state with `git merge-base --is-ancestor` against a release tag, not by commit. Keep a guard whose change has not been released. Update selection lists and triggers to match.

Rulings: Q5, Q9, Q11.

## Acceptance criteria

- [x] Each retired guard is listed with its release proof and reason. "Retired" table; `git merge-base --is-ancestor` exit 0 for each commit and tag.
- [x] Each kept parity suite is listed with the Q5 behavior it pins. "Kept" table.
- [x] No selection list or trigger names a removed file. `git grep` finds no removed name outside `docs-internal`; `testSelection.test.mjs` runs in the gates.

## Retired

Release proof is the oldest tag holding the commit. Coverage is `keptProtection.mjs coverage`, one folder pair per module.

| Guard | Change | Release | Tests | Why it goes | Coverage |
|---|---|---|---:|---|---|
| `src/lib/ownerTermGuard.test.ts`, `ownerTermGuard.ts` | `fc2d95c86` bearer to owner | v3.3.0 | 19 | The rename is finished | Module removed with its test, so exit 1 is expected |
| `src/lib/playerInputRename.test.ts` | `9b76e5bf4` `askText` to `player.input` | v3.4.0 | 1 | The rename is finished | No module; read of the test |
| Search rename tests in `searchNaming.test.ts`, now `formaquestionSettingsTabs.test.ts` | `f7c955a80` Pick to Search | v3.2.0 | 3 | The rename is finished; the Q48 and Q50 tests stay | Kept, with `helpChips.test.ts` as context |
| "the guide pages" in `scriptSurfaceGuides.test.ts` | `496d1abe9` Script Surface guides | v3.4.0 | 43 | Old forms are gone from the guides; the migration section test stays | Read of the test: it scans only guide text. `statCodeSurface.ts` coverage and kills are unchanged, but this test never reads that module, so they prove nothing |
| Drop half of `ownerTreeParity.test.ts`, `ownerTreeDrops.json` | `92bff5f30` owner tree engine | v3.3.1 | 48 | Editor drags, not Q5; the engine refactor is finished | Kept on `traitTree`, `ownedStatTree`, `ownerTree`. The parity suite's field-keeping assertion moved to `ownedStatTree.test.ts` and `traitTree.test.ts`, each red with the bug reinstated |
| `src/lib/perTurnSettle.parity.test.ts` | `a87c7a825` per-turn settle | v3.3.0 | 8 | A rollout invariant, not pipeline output | Kept on `traitRuntime`, with three sibling tests as context |

None of these tests has a real-bug record in a ledger built on the rewritten history, so Q9 needed no reinstated bug. Rule (a) marks 7 `scriptSurfaceGuides` tests, all under "the Scripts Reference", and they stay.

The always-run list loses `ownerTermGuard`, `playerInputRename` and `searchNaming`, whose remaining tests no longer read the disk. The bundled-world trigger loses `perTurnSettle.parity`.

## Kept

| Parity suite | Q5 area | Behavior it pins |
|---|---|---|
| `src/lib/turnPipeline/turnPlanParity.test.ts` | Turn pipeline | Pass order, caps and messages against the recorded run |
| `src/lib/turnPipeline/turnRunnerParity.test.ts` | Turn pipeline | The request sequence the runner dispatches |
| `src/lib/turnPipeline/parityFixture.test.ts` | Turn pipeline | The recording still holds every pass |
| `src/lib/turnPipeline/parityRecorder.test.ts` | Turn pipeline | The recorder and fixture format |
| `src/lib/testBench/scriptCheck.parity.test.ts` | Sandbox and scripts | The Bench and Test Code hand a Script the same run options |
| `src/managers/useScriptBoxContext.parity.test.tsx` | Sandbox and scripts | One script box context across the three surfaces |
| `src/lib/formaquestion/helpSession.parity.test.ts` | Prompts | Help answer request bodies, byte for byte |
| Link half of `src/lib/ownerTreeParity.test.ts` | Import | Portable and bound links of every owning bundled entity |

No guard's change is unreleased, so none stays for that reason.

## Landed

**Not verified**

- Nothing unticked.

**For you**

- Nothing to judge in play. This ticket changes tests and selection lists only.

**Problems in the Q9 steps and the check**

- 🔴 **No ledger:** `<git common dir>/test-ledger` is gone after the 2026-11-03 history rewrite. `--real-bug`, default `mutants` and default `coverage` all throw until the AFK rebuild. I built a small ledger with `--files --dir --runs 1 --coverage --history`.
- 🔴 **Q9 steps 2 to 4 still have not run for real.** No retired test has a real-bug record.
- 🟡 **A stopped run breaks its folder.** It leaves a run record with no `at`, and `buildRecords` throws a `TypeError` after the history pass. The fix was to recycle that record.
- 🟡 **A module removed with its test always reads as lost.** The check has no way to say the module goes too.
- 🟡 **Sibling tests count only under `--coverage-module`.** `settle` read as lost until three sibling tests ran with that flag in a `--context` folder.
- 🟡 **Module attribution can mislead.** The ledger names `version.ts` for `ownerTreeParity` and `perTurnSettle.parity`, which only use it as setup. That marks them `saves-import-migration`. The spec session ruled otherwise, and I did not run `version.ts` mutants.
- 🟡 **The projection can miss by far:** `statCodeSurface.ts` projected 116 mutants and ran 1302, with 1219 static, in 346 s.

**Rule (b) on the rewritten history**

- 57 of 69 failed CI runs have a head sha this clone no longer holds. They count as `unreachable` and are skipped, with one `fatal` stderr line each and no error.
- 15 logs are gone. `ci-caught` can't fire for those runs.

**Gaps left open**

- For the family sweep, under Q8 (Q49): "neighbor lookup parity with the pair enumeration" in `src/lib/locationGraphNeighbors.test.ts`, and "legacy parity" in `src/lib/placeholders.test.ts`.
- No help module is in the ledger's Q5 list, though Q5 covers help prompts.
- "has no call under the retired name" in `statCodeExecutor.prompts.test.ts` stays. It pins runtime behavior in a Q5 area.
