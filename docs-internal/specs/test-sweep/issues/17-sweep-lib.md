# 17: Sweep Lib

Status: ready-for-human
Blocked by: 13, 14, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Most Q5 logic lives here, so mutation proof and judgment matter more than speed.

Parent: [Test Sweep spec](../spec.md)

## What to build

`src/lib` goes through the Q8 bar. Time savings here are small, at 4% of test body time, so the aim is value: duplicates, weak assertions, mirrored logic and change detectors. Coverage counts only for the module under test, so a view mount's accidental coverage never condemns a library test. Q5 modules holding candidates get mutation runs, which wait for the owner's AFK signal. If the candidates exceed one session, stop at a clean batch and name the remainder for the spec session.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q4, Q5, Q6, Q8, Q9, Q22. Batch 2 also follows Q53 and Q62–Q65.

## Acceptance criteria

- [x] A deletion list names each test and its reason. See "Deletions" below. Each passed `keptProtection.mjs coverage` with exit 0, and none has real-bug history.
- [x] Each Q5 deletion has a mutation result showing no lost kills. `parityRecorder.ts` kept 149 of 149. The ledger marks `aiRequestSpec.ts` and `memoryOverrides.ts` outside Q5, but they feed the turn request, so they were run too: 222 of 222 and 48 of 48.
- [x] Each strengthened test is listed, and it fails when its behavior is broken. See "Strengthened" below. Each went red under the named source mutation, which was then reverted.
- [x] Any candidates left unswept are listed. See "Remainder" below.

## Sweep record

**Method.** An AST scan of the 920 `src/lib` test files looked for duplicate bodies, tests with no assertion, weak-only assertions (`toBeTruthy`, `toBeDefined`) and `not.toThrow`-only tests. It found 55 hits, and I judged each one by reading it. A second pass looked for change detectors: snapshots, regex literals copied from the module, and source constants pinned to a literal list. That pass found 14 hits. Every proof used fresh before and after runs, each with one timed run (Q62). The order came from the scan, not from timing: every deleted test took 10 ms or less in the ledger. Batch 1 made no speed-ups (Q63).

### Deletions

| Test | Reason | Proof |
|---|---|---|
| `aiRequest/aiRequestSpec.test.ts` › reasoning split › sends the global effort on an external endpoint that accepts it | Exact duplicate of "sends the effort, not a budget, to a target whose record leaves the budget question open" in the same scope | Coverage kept; kills 222 → 222 (request body, treated as Q5 turn-prompts) |
| `memoryOverrides.test.ts` › time stamps › stamps rows under the Recent divider too | Checks that one stamp is truthy. The test above it makes the same call and checks every stamp. | Coverage kept; kills 48 → 48 (memory band, treated as Q5 turn-prompts) |
| `docs/docsCoverage.test.ts` › reports how-to sections that could name a target (report only) | Has no assertion, so it can't fail. `untargetedSections` keeps its own unit tests. Its console report of untargeted how-to sections is gone. The owner can ask for it back as a script. | Coverage kept on `helpTopics.ts` and `docsChecks.ts` |
| `turnPipeline/parityFixture.test.ts` › validates against the recorded format | Checks only that `fixture()` doesn't throw. The next test calls `fixture()` and asserts its content. | Coverage kept; kills 149 → 149 (Q5) |

### Strengthened

| Test | Was | Now | Red under |
|---|---|---|---|
| `quarantine.test.ts` › gives the deadline as a date | `toBeTruthy` | The expiry's local date. The expected value uses the platform's date formatter, because tests pin no locale or time zone. | `toLocaleDateString` → `toLocaleString` |
| `quarantine.test.ts` › carries the deadline | `toBeTruthy` | Equals `quarantineDeadline`, and null with no expiry: a wiring check | Notice carries the raw timestamp |
| `serverDate.test.ts` › renders a parseable timestamp | `toBeTruthy` | Holds the formatted date plus more, in any locale | `timeStyle` removed |
| `statCodeExecutor.currencies.test.ts` › leaves a read-only run with no pay | `error` not null | The Tool-script pay error | Pay error text changed |
| `devRouter.test.ts` › registers the modals the router opens | Exact 90-entry list, changed in 68 commits with no bug behind it | `worldEditor` present, `localModel` absent, no repeats | `localModel` added to `DEV_MODALS` |

### Kept after reading

- Same-body hits in `traitGates`, `version` and the five world canvas tests use a different fixture in each scope.
- The other no-assertion hits assert through a helper or through `@ts-expect-error`.
- The weak-only hits are existence checks on rendered text, or loops that check every kind has a label.
- The `not.toThrow`-only hits test a contract that an error is swallowed.
- The inline snapshots in `chipValues/personaStats` and `formaquestion/helpSession.reasoning` pin prompt text and request bodies, which are behavior.
- The constant pins are server contracts (`HOSTED_REFUSALS`, feedback statuses), deliberate defaults (help options, settings, reveal, mascot rig), or turn order (`SCRIPT_TIMINGS`).
- No test copies a regex literal from its module.

### Remainder after batch 1

Batch 2 took up both bullets below. See "Batch 2".

- **Not swept:** every `src/lib` test without a scan hit. Mirrored logic shows up here only as copied regexes and constant pins. An expected value computed the way the source computes it needs a read, and those reads were not done.
- **Timer speed-ups.** Ledger body time from 2026-11-05: `imageGen/invokeai.test.ts` 19.1 s. Real polling there costs about 700 ms per test. The cause was not checked for the files below:

  | File | Body time |
  |---|---:|
  | `shippedWorld.test.ts` | 11.3 s |
  | `statCodeTurn.nestedSwitch.test.ts` | 8.7 s |
  | `statCodeTurn.inventoryChain.test.ts` | 8.5 s |
  | `statCodeVariableTree.test.ts` | 8.2 s |
  | `locationGraphNeighbors.test.ts` | 5.5 s |
  | `bundledFingerprint.test.ts` | 5.1 s |
  | `statCodeExecutor.prompts.test.ts` | 4.2 s |
  | `placeholderArt.test.ts` | 4.2 s |
  | `useCatalogSync.test.ts` | 4.0 s |

## Batch 2

**Method.** I timed each listed file per test, fresh. Then an AST scan of all 1,008 `src/lib` test files flagged expected values that call a production name or compute (arithmetic, `map`, `filter`, `sort`). After dropping literal arithmetic, joined literal lines and constant names, 651 hits in 233 files remained. Four read-only readers read every hit, and I checked each candidate they named. Proofs used fresh coverage pairs (Q62). No module touched is Q5, so no mutation run was needed.

### Speed-ups (Q63)

| Test file | Before | After | Change | Proof |
|---|---:|---:|---|---|
| `imageGen/invokeai.test.ts` | 20.1 s | 1.9 s | The provider describes use fake timers in `nextTimerAsync` mode, so each 700 ms poll wait fires at once. Assertions are byte-identical. "enqueues an SDXL graph, polls to completion" keeps real timers (Q53). | Coverage kept. Retry limit 5 → 2 turns "rides out transient network errors" red. A poll wait 100 times longer turns only the real-timer test red. |

**A live-server leak, fixed.** "stops polling instead of hanging when the item endpoint keeps erroring" left `WebSocket` unstubbed. It connected to the owner's real InvokeAI on port 9090 and read its queue events. Those events were the only cover for the ignored-event branch (`invokeai.ts:710`), so the first coverage pair failed. The test now uses the fake socket. A new test, "ignores queue events that are not invocation progress", covers that branch hermetically. It goes red when the event guard is removed.

**Not timer-bound.** The other listed files were checked and left alone:

- CPU work: `shippedWorld` (image codec), `statCodeTurn.nestedSwitch` and `inventoryChain` (QuickJS runs up to the run totals), `statCodeVariableTree` (one sandbox run per menu leaf), `locationGraphNeighbors` (the bench-sized world), `bundledFingerprint` and `bundledWorldText` (hashing), `placeholderArt` (hue spread).
- Real time is the mechanic: `statCodeExecutor.prompts` (a prompt held past the 1 s deadline) and the 1 s sandbox deadline tests in `scriptCheck`, `toolRunner` and `toolLoop`. A synchronous loop can't advance a fake clock.
- First-test warm-up, not timers: `useListingReviewMeta`, `useCachedThumbnail` and `useLanding` spend about 3 s in their first test.
- `useCatalogSync` ran in 2.5 s with no test over 400 ms.

### Added

| Test | Covers | Red under |
|---|---|---|
| `imageGen/invokeai.test.ts` › invokeaiProvider live progress › ignores queue events that are not invocation progress | The ignored-event branch at `invokeai.ts:710`, which only a live server covered before | The event guard narrowed to `if (!frame) return` |

### Mirrored values (Q64)

| Test | Was | Now | Proof |
|---|---|---|---|
| `placeholderPins.test.ts` › marks the later of two traits as the one in force | Also asserted `pins` equals `collectPins(...)`. `collectPins` is `collectPinLayers(...).pins`, so that could never fail. | The tautological line is gone. The literal `layers` check stays. | Coverage kept. Six other tests go red when the first pin wins instead of the last. |

**Kept after reading:**

- Wiring to an export with its own tests: `renderPromptTemplate` and `planDirective` in `turnPasses`, `toolSchema`, `worldMetaOf` (a thumbnail-precedence mutation turns two `src/services` tests red), `languageDirective`, `entityAddNote`, `blendColor`.
- Restated rules with the test's own numbers: `vrmThumbnail` (its own 30° field of view), `folderCamera`, `bubbleLayout`, `locationCanvas`, `imageOptim.convertible`.
- `ownedTraitsInPlay` "places a node where the author put it" derives its max from the output, but the fixture's placed node at 5 dominates. Dropping root traits from the source's max changes nothing there.
- Comparative, invariance and idempotence checks, and determinism checks.

### Remainder after batch 2

- **Not read (step 3):** `src/lib` tests with no scan hit in either batch. Batch 2 read the slowest files only for their timing cause. Their duplicates, weak assertions and change detectors were scanned in batch 1, and their mirrors in batch 2, but a hand-written mirror that the scan's patterns miss needs a read. Resume slowest first, from the 2026-11-05 ledger: `bundledWorldText` 3.8 s, `testBench/scriptCheck` 3.6 s, `statCodeExecutor.preludeCost` 3.5 s, `promptTokenGrammar` 3.0 s, `chipValues/corpusRendered` 2.6 s, `statCodeTurn` 2.3 s, `bundledWorlds` 2.3 s, `statCodeExecutor` 2.0 s, `testBench/pinConflictLoad` 2.0 s.
- **Possible CPU speed-ups (not timers):** the QuickJS run-total tests in `statCodeTurn.nestedSwitch` and `inventoryChain` (Q5), and the per-leaf sandbox runs in `statCodeVariableTree` (Q5). Each would need a mutation run on `statCodeTurn.ts` (0.79 h) or `statCodeVariableTree.ts` (0.26 h), so it waits for an AFK window (Q65).

## Landed

**Not verified:** nothing.

**For you:** nothing to judge in play. This ticket changes tests only.
