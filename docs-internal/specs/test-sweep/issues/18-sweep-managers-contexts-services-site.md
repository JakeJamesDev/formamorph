# 18: Sweep Managers, Contexts, Services And Site

Status: done
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

## Landed, batch 2

Nine deletions and two strengthened tests in `src/managers`. The gone tests held 0.84 s of body time (fresh three-run medians, Q62). All four Q64 kinds were scanned by a read of each file.

### Deleted (Q8, Q22)

| Test | Reason |
|---|---|
| `PlaceholderManager` › the state line › counts the values a Wildcard picks between | "follows the selector as it is pressed" asserts the same count line on the same kind. |
| `PlaceholderManager` › chance coloring › offers the eye whenever there is more than one value | "takes the revealed numbers down with the eye" clicks that button on three unweighted values. |
| `StatManager.bodySliders` › lists an entity model under Body Sliders only | "on None › lists the 3D model's sliders" has the same setup and grouped assertion. |
| `StatManager.bodySliders` › on None › shows the hint in the Appearance tab with no 3D model | "offers nothing, and loads nothing, for an entity with no model" asserts the same hint on the same store. |
| `StatManager.bodySliders` › on an entity with an Avatar › still marks a color when only a non-Avatar 3D model is known | Same setup and assertion as "marks every color on an entity whose model is not an Avatar". |
| `StatManager.test` › the tab strip › offers all four tabs for a numeric stat | `StatManager.panelTabs` asserts the same tab list through the real editor. |
| `TraitManager.requires` › asks which owner when an entity also has the target | `TraitManager.owned` › requirements across owners makes both assertions, and more. |
| `WorldDetailsManager` › switching a kind off keeps the text it holds | "switches a kind off and leaves its field in place" turns red if the stored text drops. |
| `WorldDetailsManager` › keeps an edited kind on its own text as the preset moves on | The mocked preset never moved. "stores the text on the first edit" and "keeps a switched-off kind editable" cover the rest. |

Coverage (`keptProtection coverage`, fresh before and after runs on the 5 edited files plus the 3 other `StatManager` files that hold covering tests): all four modules kept, 0 lost lines and 0 lost branches, exit 0. The gone list names exactly these nine. `--real-bug` lists none of them.

### Strengthened (Q22)

| Test | Change | Bite |
|---|---|---|
| `StatManager.bodySliders` › keeps a binding already on the stat removable when the model offers nothing | Clicks Remove and asserts the write, not only the button. | Remove made a no-op: red. |
| `WorldDetailsManager` › falls back to the samples for what only a turn can answer | Asserts the sample turn's action and narration, not `toBeTruthy`. | Action sample swapped for narration: red. |

### RegisterPage email trim

No test added. The email box is `type="email"`, whose value sanitizing strips the spaces around the address before the page reads it. A test with spaced input stayed green with both `.trim()` calls removed, so it could not fail. The page's trim is unreachable through the form.

### Q5 candidates, queued for an AFK mutation run (Q6)

| Module | Candidate | Covering test | Cost |
|---|---|---|---|
| `WorldStorageService.ts` | `.anonymousLikes` › reads a catalog response that says nothing as off | `WorldStorageService.test` › fetchCatalog › answers fresh with no tag when the server exposes none | 0.58 h |
| `GameDataContext.tsx` | `GameDataContext.test` › discardChanges › reverts an edit made to a field that was previously absent | "rolls the world back to the last load" also excludes `model`. | 0.63 h |

- The `GameDataContext` candidate has a real-bug comment, so Q9 also reinstates that fix.
- **Paste speed-up:** `RegisterPage`, `LoginPage` and `ResetPasswordPage` tests paste instead of typing, with assertions unchanged. The mutation cost is unpriced, because the ledger's area words miss these pages.
- The paste patch is ready but not committed. In this batch's one run it showed no clear saving (Login 1.94 s → 2.54 s, Register 3.47 s → 3.13 s, under load), so the run should first take three-run medians.
- The overlap suspected in batch 1 mostly did not hold. Guest and Install header tests differ by endpoint or by refused preflight. Dirty-marker tests differ by entry path.

### Not swept

- **Files not read:** every file in the four folders outside `PlaceholderManager`, `WorldDetailsManager`, `StatManager`, `TraitManager`, `OpeningsPanel`, `CommunityPage` and `FeedbackPage`.
- **Read, nothing found:** `OpeningsPanel`, `CommunityPage` (all three files), `FeedbackPage` (both files), `PlaceholderManager.rename`, `WorldDetailsManager.chipOptions`, and `TraitManager` apart from `requires`.
- **Weak, kept as is:** `WorldDetailsManager` › gives the editor something to preview checks `previewValues` only with `toBeTruthy`. "previews the world being edited" pins the value.
- **Read, left as medium:** `StatManager.test` › drops the Scripts and Appearance tabs (a retired type, kept on purpose). `StatManager.testCode` › the writes-ignored and read-only lines duplicate `statCodeTestRun.test`, a Q5 module, and the read-only test has real-bug history. `TraitManager.owned` › keeps the Stats tab and no owner line (its negative check is unique).
- **Change detectors seen, not changed:** the `StatManager` coverage bar reads `font-semibold`. A `PlaceholderManager` shared-row test finds rows through `span.flex-grow`. `TraitManager.requires` checks `text-destructive`. `StatManager.testCode` deep-equals whole entry shapes. Each needs a production hook or a looser match, so each is a strengthen, not a delete.
- **Mirrored logic seen:** `StatManager.preview` expects a `blendColor(...)` result. `TraitManager.sliderPins` checks its own hint constant's text.
- **Weak, in Q5 files:** `GameDataContext.test` checks `canvasPosition` by `y` only and the readme by `toBeFalsy`. These wait for the same mutation run.
- **Tooltip delay:** still ticket 16's helper. `PlaceholderManager`'s preview block spends about 2 s on it.
