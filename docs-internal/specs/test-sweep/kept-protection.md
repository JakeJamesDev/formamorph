# Kept-Protection Check

Proves a moved, merged or deleted test lost nothing (Q8, Q9, Q23). Every sweep ticket uses [`scripts/keptProtection.mjs`](../../../scripts/keptProtection.mjs) and builds no check of its own.

| Change | Prove it with | Rule |
|---|---|---|
| Move or merge in a Q5 area, or a Q5 deletion | Coverage, then mutation kills | Q23, Q8 |
| Any other move or merge | Coverage, then one reinstated bug | Q23 |
| Any other deletion | Coverage, then a read of the test | Q8 |
| Removing a test with real-bug history | Also reinstate that bug | Q9 |

> ⚠️ Leave the module's source unchanged between the before and after runs. Line, branch and mutant ids only compare at one source, and the check fails if it sees two. Land a needed source change first, then measure.

## Coverage

Deletions go **one test at a time, slowest first** (Q8), with **fresh `before` and `after` folders** for each proof.

**1. List the touched test files** in a file, one per line. Include every test file that loses or gains a test.

**2. Before the change,** write a small ledger:

```bash
node scripts/testLedger.mjs --files .scratch/kept/touched.txt --runs 1 --coverage --dir .scratch/kept/before
```

**3. After the change,** list the files that exist now and run it again with `--dir .scratch/kept/after`. An empty list is fine when every touched file is gone.

**4. Compare.** It exits 1 on any loss:

```bash
node scripts/keptProtection.mjs coverage --before .scratch/kept/before --after .scratch/kept/after
```

- **Other tests count.** A line the touched files stopped covering is still kept if a fresh record in the main ledger covers it.
- **It fails closed.** A touched file with no coverage, a failing run, no module or a different source never reads as kept. Give a file with no module a `--coverage-module`.
- **Refresh after a batch.** Earlier deletions make other files' ledger records stale, and stale records hold nothing. Refresh them with `node scripts/testLedger.mjs --files <list> --runs 1 --coverage`.
- **Heavy lists wait for AFK (Q6).** Coverage runs 8 workers by default. Lower `--coverage-workers` or wait when the list holds many view tests.
- **Gone tests are listed.** Read the list: every name should be a test you meant to remove.

### A move to another module

Coverage counts for each file's module under test, so a view test records nothing about the panel it mounts. A move from a view to a panel needs **one folder pair per module**, each compared on its own:

| Pair | Before list | After list | Flag |
|---|---|---|---|
| The view | The view test files the move edits | The same files, if they still exist | None |
| Each panel | Those view test files, plus the panel's test file if it exists | The panel's test file only | `--coverage-module src/managers/Panel.tsx` |

Leave the remaining view tests out of the panel's after list, so a view mount's accidental coverage can't stand in for the moved tests.

## Mutation kills

Coverage can't see a weakened assertion, so Q5 areas also keep their kills.

```bash
node scripts/keptProtection.mjs mutants --module src/lib/a.ts --out .scratch/kept/before.json
```

Make the change, run it again with `--out .scratch/kept/after.json`, then compare. It exits 1 on any lost kill:

```bash
node scripts/keptProtection.mjs kills --before .scratch/kept/before.json --after .scratch/kept/after.json
```

- **Static mutants are a blind spot.** Mutants in module-level code can read Survived when a test would fail: 3 of 78 and 12 of 510 here. A lost kill there goes unnoticed, so the report counts them. The coverage check still covers those lines.
- **Which tests:** the module's family in the ledger, without deleted files. Pass `--tests <list file>` on both runs when a test outside it counts: the view test before a move, the new test file after it.
- **Scanners are left out** and printed, because they would read instrumented source.
- **Incremental:** the second run reuses results for unchanged tests. Pass `--force` when a test helper changed, since Stryker can't see that.
- **Workers:** 4 by default, through `--concurrency`.
- **Wait for AFK (Q6)** when the table below prices the module above a few minutes.

## A reinstated bug

For a move outside Q5, break the moved behavior in the source and watch a moved test go red.

For a test with real-bug history (Q9):

1. Find its commit: `node scripts/testLedger.mjs --real-bug` names the rule and sha.
2. Remove the test, and undo that commit's source fix in the worktree.
3. Run the remaining tests of the family. **Another test must go red.** If none does, the test stays.
4. Restore the source and check `git diff` shows only the removal.

## Measured results

Stryker 10.1.1 on Vitest 5.0.5, in the forks pool, on 2026-11-03. Peer sessions were working.

| Module | Test files | Mutants | Detected | Survived | No coverage | Time, 4 workers |
|---|---:|---:|---:|---:|---:|---:|
| `src/lib/saveOrdering.ts` (smoke) | 1 | 78 | 47 | 24 | 7 | 12.6 s |
| `src/services/AuthService.ts` | 4 | 510 | 247 | 139 | 124 | about 90 s |

**The check bites, on `saveOrdering.ts`:**

| Change to `saveOrdering.test.ts` | Check | Result | Exit |
|---|---|---|---:|
| Swap the `groupSaves` value assertions for length checks | Kills | 47 to 42, 5 lost | 1 |
| Restore the test (incremental run, 7.8 s) | Kills | 47 to 47 | 0 |
| Remove the `mergeVisibleSaveOrder` test | Coverage | Line 12 lost, test listed as gone | 1 |

### Projected cost

**The 9-hour estimate is replaced: a Q5 module's cost ranges from seconds to days, so there is no one number.** Three view modules hold 326 of the 346 worst-case hours. The other 106 modules total about 21 hours, and the median module takes about a minute. Q8 only runs modules that hold candidates.

- **The formula:** mutants × (fixed cost + one run of the family's tests and imports) ÷ workers.
- **Calibrated on the smoke:** 2.00 mutants per ledger line and 621 ms fixed per mutant.
- **It is an upper bound on time.** Stryker runs only the tests that cover a mutant and stops at the first kill. `AuthService.ts` projected 402 mutants and 4.8 minutes, and took 510 mutants and about 90 s, so mutant counts can run 25% over.
- **The modules come from the ledger's Q5 areas,** which match path words, so it can miss a module.

Refresh it with:

```bash
node scripts/keptProtection.mjs project --module src/lib/saveOrdering.ts --mutants 78 --wall-seconds 12.6 --concurrency 4
```

### Setup notes

- **Sandbox:** in `.stryker-tmp` in the main checkout, holding the top-level entries git tracks. Never inside a worktree, because removing a worktree would follow a junction a killed run left behind.
- **One run per module at a time.** A new run clears that module's old sandboxes, and a sweep ticket holds its family alone.
- **`node_modules`:** Stryker's search skips a worktree's junction, so a build step links the main checkout's, and the tool cuts that link before it deletes the sandbox.
- **Timeouts:** `timeoutMS` is 30 s, so a peer's load is not read as a kill.

### Projection by area

| Area | Modules | Mutants | Hours, all | Hours, median module |
|---|---:|---:|---:|---:|
| saves-import-migration | 38 | 11818 | 309.6 | 0.01 |
| accounts-moderation | 18 | 5410 | 32.1 | 0.02 |
| sandbox-scripts | 41 | 7964 | 4.5 | 0.01 |
| turn-prompts | 12 | 1182 | 0.1 | 0.00 |

<details>
<summary>Every Q5 module</summary>

| Module | Area | Test files | Lines | Mutants | Hours |
|---|---|---:|---:|---:|---:|
| `src/views/GameViewer.tsx` | saves-import-migration | 32 | 2535 | 5070 | 202.40 |
| `src/views/WorldEditor.tsx` | saves-import-migration | 99 | 587 | 1174 | 95.22 |
| `src/views/MainMenu.tsx` | accounts-moderation | 16 | 951 | 1902 | 28.10 |
| `src/components/modals/SettingsModal.tsx` | saves-import-migration | 21 | 325 | 650 | 8.46 |
| `src/components/community/RemoteWorldDetailsModal.tsx` | accounts-moderation | 15 | 227 | 454 | 2.75 |
| `src/contexts/GameplayContext.tsx` | saves-import-migration | 17 | 383 | 766 | 1.85 |
| `src/lib/statCodeExecutor.ts` | sandbox-scripts | 21 | 520 | 1040 | 1.46 |
| `src/lib/statCodeTurn.ts` | sandbox-scripts | 21 | 313 | 626 | 0.79 |
| `src/lib/version.ts` | saves-import-migration | 11 | 416 | 832 | 0.74 |
| `src/lib/statCodeAnalysis.ts` | sandbox-scripts | 15 | 697 | 1394 | 0.67 |
| `src/components/modals/StatCodeTemplateDialog.tsx` | sandbox-scripts | 4 | 193 | 386 | 0.65 |
| `src/contexts/GameDataContext.tsx` | saves-import-migration | 12 | 373 | 746 | 0.63 |
| `src/services/WorldStorageService.ts` | accounts-moderation | 9 | 350 | 700 | 0.58 |
| `src/components/menu/ManageUsersTab.tsx` | accounts-moderation | 1 | 240 | 480 | 0.34 |
| `src/lib/statCodeVariableTree.ts` | sandbox-scripts | 2 | 199 | 398 | 0.26 |
| `src/lib/sandboxSnapshot.ts` | sandbox-scripts | 6 | 150 | 300 | 0.13 |
| `src/lib/statCodeRename.ts` | sandbox-scripts | 8 | 172 | 344 | 0.10 |
| `src/lib/statCodeTestRun.ts` | sandbox-scripts | 5 | 115 | 230 | 0.09 |
| `src/lib/entityFile.ts` | saves-import-migration | 6 | 149 | 298 | 0.08 |
| `src/services/AuthService.ts` | accounts-moderation | 4 | 201 | 402 | 0.08 |
| `src/managers/ScriptBox.tsx` | sandbox-scripts | 3 | 73 | 146 | 0.07 |
| `site/pages/AccountPage.tsx` | accounts-moderation | 2 | 101 | 202 | 0.07 |
| `src/lib/turnPipeline/turnPasses.ts` | turn-prompts | 2 | 182 | 364 | 0.06 |
| `src/contexts/AgeGateContext.tsx` | accounts-moderation | 1 | 223 | 446 | 0.05 |
| `src/lib/statCodeTemplates.ts` | sandbox-scripts | 2 | 129 | 258 | 0.05 |
| `src/lib/testBench/scriptCheck.ts` | sandbox-scripts | 2 | 40 | 80 | 0.04 |
| `src/lib/useComponentFileImport.tsx` | saves-import-migration | 1 | 85 | 170 | 0.04 |
| `src/lib/statCodeSurface.ts` | sandbox-scripts | 3 | 58 | 116 | 0.04 |
| `src/components/menu/AuthModals.tsx` | accounts-moderation | 1 | 61 | 122 | 0.03 |
| `src/components/game/GamePrompts.ts` | turn-prompts | 4 | 47 | 94 | 0.03 |
| `src/lib/statCodeResolver.ts` | sandbox-scripts | 1 | 196 | 392 | 0.03 |
| `src/lib/scripts.ts` | saves-import-migration | 2 | 56 | 112 | 0.02 |
| `src/lib/statLookupMigration.ts` | saves-import-migration | 1 | 62 | 124 | 0.02 |
| `src/lib/turnPipeline/turnRunner.ts` | turn-prompts | 1 | 106 | 212 | 0.02 |
| `src/lib/tools/toolTextMigration.ts` | saves-import-migration | 1 | 88 | 176 | 0.02 |
| `site/components/SiteAgeGate.tsx` | accounts-moderation | 1 | 73 | 146 | 0.02 |
| `src/lib/turnPipeline/computeTurnCommit.ts` | turn-prompts | 1 | 83 | 166 | 0.02 |
| `src/lib/chipValues/authoredScene.ts` | sandbox-scripts | 2 | 44 | 88 | 0.02 |
| `src/components/menu/AccountSettingsTab.tsx` | accounts-moderation | 1 | 60 | 120 | 0.02 |
| `src/lib/scriptTextMigration.ts` | saves-import-migration | 1 | 88 | 176 | 0.01 |
| `src/components/game/ScriptPromptLine.tsx` | sandbox-scripts | 1 | 55 | 110 | 0.01 |
| `src/lib/backupScan.ts` | saves-import-migration | 1 | 145 | 290 | 0.01 |
| `src/lib/statCodeTargets.ts` | sandbox-scripts | 1 | 109 | 218 | 0.01 |
| `src/components/menu/AdminPanelDialog.tsx` | accounts-moderation | 1 | 30 | 60 | 0.01 |
| `src/lib/statCodeRoutes.ts` | sandbox-scripts | 2 | 63 | 126 | 0.01 |
| `src/lib/blueprints.ts` | sandbox-scripts | 2 | 118 | 236 | 0.01 |
| `src/lib/worldScripts.ts` | sandbox-scripts | 1 | 89 | 178 | 0.01 |
| `src/lib/statCodePaths.ts` | sandbox-scripts | 1 | 81 | 162 | 0.01 |
| `src/components/menu/DeleteAccountDialog.tsx` | accounts-moderation | 1 | 34 | 68 | 0.01 |
| `src/lib/statCodeTraits.ts` | sandbox-scripts | 1 | 70 | 140 | 0.01 |
| `src/managers/ScriptsSection.tsx` | sandbox-scripts | 1 | 23 | 46 | 0.01 |
| `src/lib/memoryView.ts` | sandbox-scripts | 1 | 62 | 124 | 0.01 |
| `src/components/design-system/ScriptPromptLineReference.tsx` | sandbox-scripts | 1 | 20 | 40 | 0.01 |
| `src/lib/scriptSandbox.ts` | sandbox-scripts | 1 | 55 | 110 | 0.01 |
| `src/lib/stPersonaImport.ts` | saves-import-migration | 1 | 54 | 108 | 0.01 |
| `src/lib/backup.ts` | saves-import-migration | 2 | 31 | 62 | 0.01 |
| `src/lib/turnPipeline/parityRecorder.ts` | turn-prompts | 2 | 70 | 140 | 0.01 |
| `src/lib/lorebookImport.ts` | saves-import-migration | 1 | 68 | 136 | 0.01 |
| `src/lib/useWorldExport.tsx` | saves-import-migration | 1 | 25 | 50 | 0.01 |
| `src/lib/statCodeWriteScan.ts` | sandbox-scripts | 1 | 48 | 96 | 0.01 |
| `src/components/modals/SaveList.tsx` | saves-import-migration | 1 | 21 | 42 | 0.01 |
| `src/lib/listingModeration.ts` | accounts-moderation | 1 | 54 | 108 | 0.01 |
| `src/lib/backupRestore.ts` | saves-import-migration | 1 | 38 | 76 | 0.01 |
| `src/components/menu/WebVersionChangelog.tsx` | saves-import-migration | 1 | 21 | 42 | 0.01 |
| `src/lib/scriptPrompts.ts` | sandbox-scripts | 1 | 58 | 116 | 0.01 |
| `src/components/editor/useSaveStatus.ts` | saves-import-migration | 1 | 35 | 70 | 0.01 |
| `src/components/modals/dbUtils.ts` | saves-import-migration | 2 | 41 | 82 | 0.01 |
| `src/contexts/AccountDeletionContext.tsx` | accounts-moderation | 1 | 24 | 48 | 0.00 |
| `src/lib/ageGate.ts` | accounts-moderation | 1 | 31 | 62 | 0.00 |
| `src/lib/autoSaveScheduler.ts` | saves-import-migration | 1 | 45 | 90 | 0.00 |
| `src/lib/tools/toolScriptSurface.ts` | sandbox-scripts | 1 | 18 | 36 | 0.00 |
| `src/lib/componentExportLinks.ts` | saves-import-migration | 1 | 20 | 40 | 0.00 |
| `src/lib/scriptBoxHome.ts` | sandbox-scripts | 1 | 30 | 60 | 0.00 |
| `src/lib/turnPipeline/planTurn.ts` | turn-prompts | 3 | 8 | 16 | 0.00 |
| `src/managers/useScriptBoxContext.ts` | sandbox-scripts | 1 | 19 | 38 | 0.00 |
| `src/lib/saveOrdering.ts` | saves-import-migration | 1 | 39 | 78 | 0.00 |
| `src/lib/globalSaveFields.ts` | saves-import-migration | 1 | 25 | 50 | 0.00 |
| `src/lib/turnPipeline/narrationReading.ts` | turn-prompts | 1 | 30 | 60 | 0.00 |
| `src/lib/revealTestScripts.ts` | sandbox-scripts | 1 | 34 | 68 | 0.00 |
| `src/lib/docs/bundledDocsIndex.ts` | sandbox-scripts | 3 | 6 | 12 | 0.00 |
| `src/lib/contentLink.ts` | saves-import-migration | 2 | 21 | 42 | 0.00 |
| `src/lib/statCodeBoxOptions.ts` | sandbox-scripts | 1 | 14 | 28 | 0.00 |
| `src/lib/contentReports.ts` | accounts-moderation | 1 | 30 | 60 | 0.00 |
| `src/lib/importFiles.ts` | saves-import-migration | 1 | 17 | 34 | 0.00 |
| `scripts/versionSiteImages.mjs` | saves-import-migration | 1 | 22 | 44 | 0.00 |
| `src/lib/scriptTells.ts` | sandbox-scripts | 1 | 27 | 54 | 0.00 |
| `src/components/menu/UpdateVersionControl.tsx` | saves-import-migration | 1 | 8 | 16 | 0.00 |
| `src/lib/useScriptWorldNames.ts` | sandbox-scripts | 1 | 16 | 32 | 0.00 |
| `src/lib/turnPipeline/narrationPrompt.ts` | turn-prompts | 1 | 23 | 46 | 0.00 |
| `src/lib/useSettleOnSaveLoad.ts` | saves-import-migration | 1 | 16 | 32 | 0.00 |
| `src/lib/formaquestion/scriptInsert.ts` | sandbox-scripts | 1 | 24 | 48 | 0.00 |
| `src/lib/componentImport.ts` | saves-import-migration | 1 | 19 | 38 | 0.00 |
| `src/lib/devFixtures/longSave.ts` | saves-import-migration | 1 | 12 | 24 | 0.00 |
| `src/lib/turnPipeline/pendingRequests.ts` | turn-prompts | 1 | 18 | 36 | 0.00 |
| `src/lib/autosave.ts` | saves-import-migration | 1 | 18 | 36 | 0.00 |
| `src/lib/turnPipeline/turnErrors.ts` | turn-prompts | 1 | 9 | 18 | 0.00 |
| `src/lib/scriptPins.ts` | sandbox-scripts | 1 | 16 | 32 | 0.00 |
| `src/lib/saveConversion.ts` | saves-import-migration | 1 | 9 | 18 | 0.00 |
| `src/lib/editorScriptPrompts.ts` | sandbox-scripts | 1 | 13 | 26 | 0.00 |
| `src/lib/promptSamplers.ts` | turn-prompts | 1 | 12 | 24 | 0.00 |
| `src/lib/statCodeNames.ts` | sandbox-scripts | 1 | 10 | 20 | 0.00 |
| `src/lib/accountAge.ts` | accounts-moderation | 1 | 9 | 18 | 0.00 |
| `src/services/authRequest.ts` | accounts-moderation | 1 | 6 | 12 | 0.00 |
| `src/lib/worldImport.ts` | saves-import-migration | 1 | 8 | 16 | 0.00 |
| `src/lib/turnPipeline/plannerBand.ts` | turn-prompts | 1 | 3 | 6 | 0.00 |
| `src/lib/statCodePlaceholderPlaces.ts` | sandbox-scripts | 1 | 4 | 8 | 0.00 |
| `src/components/ImageConvertOverlay.tsx` | saves-import-migration | 1 | 2 | 4 | 0.00 |
| `src/lib/worldScriptTemplates.ts` | sandbox-scripts | 1 | 1 | 2 | 0.00 |
| `src/lib/savedReasoning.ts` | saves-import-migration | 1 | 2 | 4 | 0.00 |

</details>
