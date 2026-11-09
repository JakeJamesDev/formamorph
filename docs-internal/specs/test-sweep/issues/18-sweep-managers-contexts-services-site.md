# 18: Sweep Managers, Contexts, Services And Site

Status: ready-for-human
Blocked by: 13, 14, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Storage and account paths sit in Q5 areas, so deletion judgment still matters.

Parent: [Test Sweep spec](../spec.md)

## What to build

`src/managers`, `src/contexts`, `src/services` and `site` go through the Q8 bar. Storage and account tests sit in Q5 areas. If the candidates exceed one session, stop at a clean batch and name the remainder for the spec session.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q4, Q5, Q6, Q8, Q9, Q22.

## Acceptance criteria

- [x] A deletion list names each test and its reason. Three tests, in Landed below; `keptProtection coverage` exit 0, gone list matches.
- [x] Each Q5 deletion has a mutation result showing no lost kills. This batch deletes no Q5 test; Q5 candidates wait for an AFK mutation window.
- [x] Each strengthened test is listed, and it fails when its behavior is broken. None strengthened; the one weak candidate was not sole coverage, so Q22 deleted it.
- [x] Any candidates left unswept are listed. In Landed below.

## Landed

First clean batch. About 6 s of test body time is gone (fresh three-run medians, Q62).

### Deleted (Q8, Q22)

| Test | Reason |
|---|---|
| `LocationManager.test.tsx` › the location pin section › mounts its help topic | `LocationManager.panelTabs` asserts the same button on the Pins tab. Breaking the topic id turns that test red. |
| `TraitManager.test.tsx` › the section help buttons › mount registered topics for all three sections | `TraitManager.panelTabs` asserts all three buttons on their tabs. |
| `ModelStorageService.test.ts` › addModel metadata › records a content hash | Asserted only `toBeTruthy`. A wrong hash turns two other tests red (identical-bytes dedupe, bundled hash). |

Coverage on all three modules (`keptProtection coverage`, fresh before and after runs): 0 lost lines and 0 lost branches, exit 0. No test had real-bug history.

### Sped up (Q63)

Five `SettingsContext` tests slept through the real 1200 ms resolve debounce. They now advance fake timers past it, then switch back to real timers. Assertions are byte-identical. `SettingsContext.tsx` is outside Q5.

| File | Body time, median of 3 |
|---|---|
| `SettingsContext.unmountResolve` (3 tests) | 3.67 s → 0.05 s |
| `SettingsContext.lmStudioSwap` (1 test) | 1.24 s → 0.03 s |
| `SettingsContext.observation` › names the dialect (whole file shown) | 1.30 s → 0.10 s |

- Coverage pair on `SettingsContext.tsx`: kept, 0 lost.
- Bite: the debounce set to 99999 ms turns all five red. Removing the unmount abort turns the two unmount tests red.

### Not swept

- **All other files** in the four folders. Slowest first: `PlaceholderManager` (9.2 s), `WorldDetailsManager` (8.3 s), `StatManager.testCode` (7.9 s), `StatManager` (5.9 s), `TraitManager` (3.8 s), `WorldStorageService` (3.1 s), `OpeningsPanel` (2.4 s), `CommunityPage` integration pair (3.7 s), `FeedbackPage.filing` (1.8 s).
- **Q5 candidates that need a mutation run (Q6 AFK):** `WorldStorageService.anonymousLikes`, `.likePrompt` and `.installHeaderFallback` assert overlapping guest and Install headers; `GameDataContext.history`, `.actions`, `.saveBaseline` and `.test` share dirty-marker assertions. Projected cost: `WorldStorageService.ts` 0.58 h, `GameDataContext.tsx` 0.63 h.
- **Q5 speed-ups left out:** pasting instead of typing in `RegisterPage`, `LoginPage` and `ResetPasswordPage` tests saved 1.6 s with coverage kept. These are account pages (Q5), so Q63 needs a mutation run first. The ledger's area words miss them.
- **`SortableTree` › a long tree:** 250 rows instead of 400 saved 0.4 s, but changes two expected values, so Q63 leaves it out.
- **Kinds not scanned (Q64):** mirrored logic and change detectors. Duplicates and weak assertions were scanned by assertion shape only. Tests that assert through helpers were not checked for asserting nothing.
- **Stale ledger records:** 35 of the 159 files hold stale coverage, so their file-level overlap needs a refresh first.
- **Tooltip delay:** each Tip hover waits the real 400 ms. 6 hovers sit here (2.4 s in `PlaceholderManager`'s preview block), 81 in ticket 16's folders. A test-only zero delay is a shared-helper change.
- **Gap seen, not fixed:** no test checks that `RegisterPage` trims the email it sends.

**Not verified:** nothing unticked.

**For you:** nothing to judge in play; this batch changes tests only.
