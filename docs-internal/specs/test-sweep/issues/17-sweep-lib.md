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

Rulings: Q4, Q5, Q6, Q8, Q9, Q22.

## Acceptance criteria

- [x] A deletion list names each test and its reason. See "Deletions" below. Each passed `keptProtection.mjs coverage` with exit 0, and none has real-bug history.
- [x] Each Q5 deletion has a mutation result showing no lost kills. `parityRecorder.ts` kept 149 of 149. The ledger marks `aiRequestSpec.ts` and `memoryOverrides.ts` outside Q5, but they feed the turn request, so they were run too: 222 of 222 and 48 of 48.
- [x] Each strengthened test is listed, and it fails when its behavior is broken. See "Strengthened" below. Each went red under the named source mutation, which was then reverted.
- [x] Any candidates left unswept are listed. See "Remainder" below.

## Sweep record

**Method.** An AST scan of the 920 `src/lib` test files looked for duplicate bodies, tests with no assertion, weak-only assertions (`toBeTruthy`, `toBeDefined`) and `not.toThrow`-only tests. It found 55 hits, and I judged each one by reading it. A second pass looked for change detectors: snapshots, regex literals copied from the module, and source constants pinned to a literal list. That pass found 14 hits. Every proof used fresh before and after runs, each with one timed run (Q62). The order came from the scan, not from timing: every deleted test took 10 ms or less in the ledger. This ticket made no speed-ups (Q63).

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

### Remainder

- **Not swept:** every `src/lib` test without a scan hit. Mirrored logic shows up here only as copied regexes and constant pins. An expected value computed the way the source computes it needs a read, and those reads were not done.
- **Timer speed-ups (out of this ticket).** Ledger body time from 2026-11-05: `imageGen/invokeai.test.ts` 19.1 s. Real polling there costs about 700 ms per test. The cause was not checked for the files below:

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

## Landed

**Not verified:** nothing.

**For you:** nothing to judge in play. This ticket changes tests only.
