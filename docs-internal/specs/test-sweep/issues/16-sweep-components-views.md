# 16: Sweep Components And Views

Status: ready-for-human
Blocked by: 13, 14, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Deletion judgment across the most expensive tests.

Parent: [Test Sweep spec](../spec.md)

## What to build

The ledger's slowest remaining tests in `src/components` and `src/views` go through the Q8 bar one at a time. A test with real-bug history follows Q9. Weak or mock-only tests are strengthened when they alone cover a behavior and deleted otherwise (Q22). If the candidates exceed one session, stop at a clean batch and name the remainder for the spec session.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q4, Q5, Q8, Q9, Q22, Q23.

## Acceptance criteria

- [x] A deletion list names each test and its reason. See Deletions and merges.
- [x] Each strengthened test is listed, and it fails when its behavior is broken. See Strengthened in both batches; each goes red under its reinstated bug, and batch 2's old forms stayed green under the same bugs.
- [x] Time saved is recorded, along with any candidates left unswept. See Time and Left unswept.

## Results

The ledger (2026-11-05, c1f0a26fa) only set the order (spec session ruling). Every proof below uses fresh runs on this tree. One clean batch landed; the remainder is listed for the spec session.

### Deletions and merges

| Test | File | Reason |
|---|---|---|
| the Demo AI turn count > skips the opening and counts each later player action | `GameViewer.storyCard.test.tsx` | Four sibling tests assert a count of 1 after one action, which fails if the opening counts. |
| gives a played Rogue the extra items | `GameViewer.emberwatchItems.test.tsx` | Same setup as "gives the bonus once when the player regenerates the opening", which now also asserts the 500 before the regenerate (Strengthened). |
| seeds a non-Rogue purse…, gives a Rogue in the cast…, runs no bonus for a Custom Persona nobody picked, tracks Jory Pike… | `GameViewer.emberwatchItems.test.tsx` | Merged into one test on the same Albus opening. Assertions are unchanged; the Inventory tab read moves last. |

None has real-bug history. The ledger shows no fix-commit or CI record; every recorded failure of these tests is from session transcripts, which Q42 does not count. `git log -S` finds only feature and rename commits. CI runs after 2026-11-04 were not read.

### Strengthened

| Test | Change | Proof |
|---|---|---|
| gives the bonus once when the player regenerates the opening | Asserts the played Rogue's 500 after the opening too, which the deleted played-Rogue test held. | Red with the start scripts skipped on the opening, and with `give` ignoring its quantity. |

### Speed-ups

| Test | Before | After | Change |
|---|---:|---:|---|
| MainMenu.tourPlay > stops at the same source gate Enter World stops at | 10.4 s | 2.8 s | Waited the 10 s find timeout for a negative. It now waits for the editor to close, then gives the Introduction 2 s. A broken gate shows it 140 ms after the editor closes. |

### Kept protection

- Coverage pair over the three files: `GameViewer.tsx` and `MainMenu.tsx` kept, 0 lost lines and 0 lost branches. Gone tests listed: exactly the six above.
- Reinstated bugs, each restored and checked with `git diff`:
  - `GameViewer.tsx`: counting the opening turn turned 4 turn-count tests red.
  - `GameViewer.tsx`: skipping the start scripts on the opening turned the merged test and the regenerate test red (5 of 6 in the file).
  - `MainMenu.tsx`: skipping the source block in `startEntry` turned the rewritten gate test red. A first rewrite that waited for the alert stayed green under this bug, so it was replaced.
- Q50: the Emberwatch tests run real start scripts in the stat sandbox, unmocked. Coverage pair on `src/lib/statCodeExecutor.ts` (Base file before, new file after): kept, 0 lost lines and 0 lost branches. Reinstated bug in it: `give` ignoring its quantity turned the merged test and three others red.
- No Stryker run: none of the three files has a Q5 module under test, and Q50 covers the Q5 code the merged test calls.

### Time

Test-body time, one run each:

| File | Before | After |
|---|---:|---:|
| `GameViewer.emberwatchItems.test.tsx` | 17.7 s | 10.9 s |
| `GameViewer.storyCard.test.tsx` | 50.8 s | 44.6 s |
| `MainMenu.tourPlay.test.tsx` | 12.4 s | 4.4 s |
| Total | 80.9 s | 59.9 s |

### Kinds scanned (Q64)

| Kind | Scope | Result |
|---|---|---|
| Duplicates | The three batch files | Two deletions and one merge, above. |
| Tests that assert nothing | Every test file in both folders, by a static read of each `it` body | None. The five hits, all in `GameViewer.bundledSaves`, assert in their shared helpers. |
| Negative waits on the find timeout | Both folders | One, the tour Play speed-up. |
| Weak assertions, mirrored logic, change detectors | Not scanned | Left for the next batch. |

### Left unswept

Ranked by a fresh run where one exists:

- **Views:** `GameViewer.pay` (47.7 s, 22 tests), `.turnRead` (46.1 s), `.openingAction` (25.9 s), `.clockAdvance` (25.5 s), `.betweenTurnLoop` (20.5 s), `.outputScripts` (19.0 s), `WorldEditor.tourLocations` (29.7 s; one 10 s flow test) and `.tourEntities` (22.1 s). Each test reads as a distinct behavior; a merge needs a deeper read.
- **Components:** `FormaquestionMascotTab.test.tsx` (91 s, 110 tests, all distinct; cost is the mount, so a shared mount is the lever), `LicensesPanel` (18.6 s), `CodeArea` and `.cards`, `EventFormDialog`, `ToolsTab.edit`, `SettingsModal.promptOptions` and `.reasoning`.
- **Fixed sleeps,** about 3 s in all: `FeedbackSuggestPlugin` (5 × 250 ms), `RemoteWorldDetailsModal.autocomplete`, `CodeArea`, `MainMenu.firstRun`, `GameViewer.bodyWrites`.
- `GameViewer.bundledSaves` stays under Q51.

## Results, batch 2

Q66 chose more batches. Batch 2 took the tooltip delay, then weak assertions, mirrored logic and change detectors. The spec session ruled the weak-assertion bar and scope (see Kinds scanned). All proofs use fresh runs on this tree.

### Speed-up: the tooltip open delay (Q63)

- `src/test/setup.ts` sets the shared tip delay to 0 through a new seam, `src/components/ui/tooltipTiming.ts`. The seam has no imports, so setup loads no Base UI. Production still passes 400 ms; the group timeout is unchanged.
- No assertion changed in any sped-up file.
- The real delay keeps one test: `tooltip.test.tsx` > the open delay > opens a hovered tip after the shared delay, not before. It goes red when the provider passes 0 and when it drops `delay` (Base UI's default).
- Coverage pair over the 34 component and view files that hover: every module kept, 0 lost lines and 0 lost branches. `tooltip.tsx` lost one line by text, the constant that moved to `tooltipTiming.ts`.
- Time, two alternating pairs on the 34 files: 16 files dropped in both pairs, 32.6 s → 20.2 s (12.4 s saved). Total body time was 212.5 s → 207.2 s; the WorldEditor files' noise hides the rest.

### Deletions

| Test | File | Reason |
|---|---|---|
| Narration Layout: Pages > renders the latest page unchanged | `GamePanels.chatLayout.test.tsx` | Change detector: a 51 KB DOM snapshot that UI changes rewrote 8 times in two months. It was parity for the Pages-to-Turn-Card move of 2026-09-19, inside a file that stays, so Q49 sends it through Q8. |
| Narration Layout: Pages > renders a past page unchanged | Same | Same. The snapshot file goes too. |

- Q8 evidence: a coverage pair over the 28 GamePanels and glyph test files kept `GamePanels.tsx`, 0 lost lines and 0 lost branches. Gone tests listed: exactly these two. The file's other tests still check what the Pages layout shows and where.
- No real-bug history: `--real-bug` lists neither test. The one `Fix` commit to touch the snapshot (4d3172ff3) only rewrote it and did not add the test, so Q42 does not count it.
- The `TOOL_GLYPH` pin in `glyphMap.test.ts` stays. It is the only check of the glyph the view shows for a Tool round, like the hand-written glyph table beside it.

### Strengthened

| Test | Change | Proof |
|---|---|---|
| TriggersInstrument history > takes earlier messages and reports how many are being traced | Asserts the typed history text, not only a call. | Red when the box reports the old history; the old form stayed green. |
| UnreadableWorldsDialog > reports a bundled world that fails to reseed | Asserts the error and the headline that names the world. | Red when the name drops its bundled-world fallback; the old form stayed green. |
| ModelViewer teardown > stops the mixer and the render loop on unmount | Asserts the cancel gets the loop's frame id. | Red when the loop drops its frame id; the old form stayed green. |
| a buy at the turn commit > moves items and item together, and the items fire their When Lost script | Vigor is exactly 49, not below 50. When Lost runs once per Item Instance (Scripts Reference, Instance). | Red when When Lost fires once per unit; the old bound held at 48. |

### Kinds scanned (Q64)

| Kind | Scope | Result |
|---|---|---|
| Weak assertions | An AST filter over every test in both folders for tests whose only non-getBy assertions are a bare `toHaveBeenCalled()`, a loose bound or `toBeDefined` (57 hits). Then any weak matcher in the batch 1 Left-unswept files and the 20 slowest files (42 hits in 31 files). Each hit read. | 4 strengthened, above. The rest carry their behavior: ordering and range checks, timing budgets, zero-argument callbacks, gate checks where the publish payload is not the claim, and preconditions next to exact checks. |
| Mirrored logic | An AST filter for expectations whose expected side calls the same production function as the actual side. | None. The 3 hits compare one function across inputs (two equivalences, one memo identity). |
| Change detectors | Snapshot matchers and constant pins in both folders. | 2 deletions, above. The three constant pins stay: `glyphMap` holds the only check of the Tool glyph, `ToolsTab` pins the catalog against mutation, and `GameViewer.storyCard.noHosted` checks its build flag. |

Not scanned: duplicates outside batch 1's three files; weak assertions outside the ruled scope; mirrors written as test-local reimplementations; class-name assertions as change detectors.

### Left unswept, batch 2

- Everything on the batch 1 list, apart from the weak-assertion read above.
- Fixed sleeps, about 3 s, unchanged. Two more: `collapsing-tabs-list` and `collapsing-toggle-group` sleep `TOOLTIP_DELAY_MS + 100` real time to show a tip stays shut, which the zero delay now makes longer than needed.
- `FormaquestionMascotTab` (91 s): a shared mount is still the lever.

## Landed

**Not verified:** batch 1 used single timing runs; batch 2's delay speed-up used two alternating pairs, and its deletion times are single runs.

**For you:** nothing. Batch 2's one product change is the tooltip delay seam, which ships the same 400 ms.
