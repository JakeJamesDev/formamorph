# 13: Selection Narrowing

Status: ready-for-human
Blocked by: 06, 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: This changes which tests guard every landing, so it is the highest-risk ticket in the effort.

Parent: [Test Sweep spec](../spec.md)

## What to build

Selection gets narrower only where the harness proves it safe (Q12). Candidates are type-only edges, barrel fan-out and mock-factory closures, plus `recordDependencies` if ticket 1 adopted it. Path triggers stay for `fs` reads. Each miss, including those ticket 6 listed, gets a rule or blocks that narrowing. The full suite still runs on push, at close-spec and at release (Q13).

Heavy runs wait for the owner's AFK signal (Q6).

Rulings: Q2, Q6, Q12, Q13.

## Acceptance criteria

- [x] The harness reports zero misses on the narrowed selection, on at least 36 bugs that turn a test red (Q48), with its sample size and upper bound. Verified: the seed-2 run found 0 misses in 41 bugs, upper bound 7.3%. The seed-1 rescore found 0 in 37, upper bound 8.1%.
- [x] Precision before and after, and affected-gate time before and after, are recorded. Verified: "Precision And Gate Time" below, from two rescores and a timed listing.
- [x] Each rule has a test that goes red when the rule is removed. Verified: 11 mutations of `testSelection.mjs` each turned a named test in `testSelection.test.mjs` red, and the source was restored and compared byte for byte.

For you: Accept or reject the narrowing, from the harness result and its sample size.

## Narrowing Candidates

Measured 2026-11-06 on a static model of the runtime import graph: 3,967 files and 1,829 tests, each TypeScript file transpiled as `isolatedModules` would. On the replay's 39 sampled code-mutant files the model selects 9,100 tests, against the replay's 9,544. The replay's count also holds the always-run floor of 22 tests on each case, and the model doesn't apply mock pruning.

| Candidate | Saving | Why |
|---|---:|---|
| Type-only edges | 0 | Vite's transform drops an import used only as a type, so `vitest related` never walks it. |
| Mock-factory closures | 0 | Vitest 5 already limits each test's walk by its `vi.mock` set. This is where the trial's 46 dropped files came from. |
| Barrel fan-out | 13 of 9,100 (0.14%) | Only 6 barrels exist, and `@/types` has no runtime import. One file of 39 saved anything. |
| `recordDependencies` | Not tried | The trial ruled it off, and `vite.config.js` doesn't set it. |

**The fan-out is real runtime reach.** For example, `bodies.ts` reaches 885 tests through contexts and app modules, and its largest single hub (`mediaIndex.ts`) carries only 111. A depth limit would drop tests that load the changed file, which Q2 rules out.

**Ruling (spec session, option A):** no narrowing. The ticket lands the deletion rule and proves zero misses with the replay.

## Deletion Rule

`vitest related` can't walk an import to a file that is gone. That caused all 3 of ticket 06's misses. The gate now adds each file whose import, require, `vi.mock`, `new URL(…, import.meta.url)` or `import.meta.glob` names a deleted path.

- `vocab.json` adds `g2pModel.ts`, and through it all 4 missed tests. Checked end to end: with the file gone, `vitest related` selected all 4.
- `open-chat.json` adds `defaultWorlds.test.ts` through its glob.
- `sectionVectors.json` adds `sectionVectors.test.ts` and `helpSemantic.ts`.
- The scan reads the tree only when a touched path is gone. It took 0.65 s on this tree.

## Zero-Miss Proof

Seed 2 on main `9280de057`, with this ticket's selector. Started 05:22 UTC on 2026-11-08 and finished all 72 cases in 6 h 45 min, inside the 7.5 h cap.

| Injected | Tried | Turned a test red | Missed | Miss rate upper bound (95%) |
|---|---:|---:|---:|---:|
| Landings | 12 | 8 | 0 | 37.5% |
| Code mutants | 40 | 30 | 0 | 10.0% |
| Data mutants | 20 | 3 | 0 | 100.0% |
| **All** | 72 | 41 | 0 | 7.3% |

- **No misses in 41 bugs** (Q48 asks for 36). 229 red files, all selected. Bound method: rule of three.
- **Precision:** 1.7%. The gate selected a median 5.7% of test files.
- **One invalid run:** the listing for `landing:05bc1f7d1` exits 1 on a parse error in `docs/Avatars.md`. The pre-ticket selector fails the same way on that landing, so the deletion rule didn't cause it.
- **The gate fails closed there.** In a clone of that landing, with its own install, `vitest related --run` exited 1 before it ran a test. That landing pins Vitest 3.2.6, and its import analysis can't parse a `.md` file. The gate passes Vitest's exit status through, and it reruns only files that failed by timeout, so the gate goes red.
- **Peer load:** the gate lock was held in 3 of 404 minute samples, 05:35 to 05:38 UTC. Whole-machine CPU had a median of 65%, p90 68% and a max of 100%, with the GPU session running.

## Precision And Gate Time

Both rescores ran on 2026-11-09 from 04:50 to 07:09 UTC. "Before" is the Base selector, which is this ticket's selector without the deletion rule. Both rows use the replay's own formula (`summarize`).

| Sample | Selector | Bugs | Missed files | Precision | Mutants only |
|---|---|---:|---:|---:|---:|
| Seed 2 | Before | 41 | 0 | 1.65% | 1.93% |
| Seed 2 | After | 41 | 0 | 1.65% | 1.93% |
| Seed 1 (ticket 06's rescore) | Before | 36 | 6 | 2.16% | 2.45% |
| Seed 1 | After | 37 | 0 | 1.49% | 2.55% |

- **Seed 2 doesn't change.** None of its cases deletes a file that code imports, so the rule adds nothing.
- **Seed 1 compares on its mutants only.** Its 60 mutants are the same sample in both runs, but the landing pool grew with main, so the 12 landings differ. On the mutants, the 3 deletion misses became hits.
- **Seed 1 after: no misses in 37 bugs**, upper bound 8.1%. 3 landings were invalid on the same Vitest 3 `.md` parse error as `05bc1f7d1`.
- **Gate time:** the listing step took 0.18 s with either selector when no touched path is gone. With `vocab.json` gone it took 0.54 s warm (1.72 s cold) after, against 0.18 s before. The test run itself is unchanged except for the added files.
- **Peer load:** a peer held the gate lock in 18 of 139 minute samples, 04:51 to 05:15 UTC, during the seed-2 rescore. CPU had a median of 33%, p90 76% and a max of 100%. Every red had to go red again alone, so load can't add a red.

## Landed

**Not verified**

- The data-mutant bound stays wide: seed 2 has 3 data bugs and seed 1 has 6, so each kind's own bound is 50% or more. The 0-miss claim holds for the pooled sample.
- Seed 1's landings aren't the sample ticket 06 drew, because the landing pool grew with main. Only its mutants compare before and after.
- The gate on a landing that pins Vitest 3 fails closed on a `.md` parse error, so that landing's selection can't be scored. 4 landings across both samples hit it.

**For you**

- Accept or reject the narrowing, from the harness result and its sample size. Option A adopts no narrowing: the ticket lands only the deletion rule, with 0 misses in 41 bugs (seed 2) and 37 bugs (seed 1).
