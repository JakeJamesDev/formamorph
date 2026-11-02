# Reference Run

Measured 2026-11-02 on Vitest 5.0.5, Vite 8.3.5 and Node 24.18.0, 32 logical cores. The tree was `4de00d8d2` plus this ticket, so each checkout has its own module cache (Q44).

## Owner's targets (Q3)

| Target | Value |
|---|---:|
| Full suite | 240 s, from 330 s |
| Affected gate, on the 610-file sample below | 200 s, from 279 s warm |

## Times

| Run | Wall s | Files | Tests | Peer gate lock held | CPU median |
|---|---:|---:|---:|---:|---:|
| Full suite 1 | 540.7 | 1,745 | 31,851 | 34 of 34 samples | 100% |
| Full suite 2 | 439.6 | 1,745 | 31,851 | 18 of 30 samples | 84% |
| Full suite 3 | 329.7 | 1,745 | 31,851 | 0 of 22 samples | 69% |
| Affected gate, empty cache | 303.1 | 610 | 8,245 | 4 of 20 samples | 83% |
| Affected gate, warm cache | 278.5 | 610 | 8,245 | 7 of 19 samples | 85% |

All five runs exited 0 with 0 unhandled errors in the ledger's runs. No test needed a rerun.

**Use 330 s as the full-suite figure.** The three-run median is 440 s, but peers' gates ran through runs 1 and 2. Run 3 had no peer gate, and it agrees with the 322 s and 334 s from [the Vitest trial](vitest-trial.md).

**The gate's empty-cache cost is about 25 s (8%).** Both gate runs had similar load, but this is one pair under load, so treat it as a rough figure. Cache keys include the checkout's root, so every ticket pays it on its first gate. The folder held 309 MB after all runs.

### What the gate timed

- **Fresh ticket worktree:** this ticket's, with no cache folder before the first run.
- **Sample change:** the 24 changed files of `6adfa5bf8`, a recent ticket that touched `src/`. It selected 610 test files.
- **Tests only:** the times cover `affectedTests.mjs`, not typecheck, lint or the build.

### Load conditions

- The owner gave the AFK signal through the spec session. Other ticket sessions kept working.
- Peer gates held the lock during runs 1 and 2 and both gate runs, so these are not clean. The holders were `currency-08`, `release-avatar-license-07` and `script-run-order-01`.
- A driver sampled CPU, Node process count and the gate lock every 15 s. It waited up to 5 minutes for a free lock before each step.
- The calibration loop stayed at 0.24–0.29 ms. It did not detect this load, so it can't prove a run clean.

## Where the time goes

Worker seconds from the median run, summed across workers:

| Part | Seconds | Share |
|---|---:|---:|
| Test bodies | 2,901 | 46% |
| Import (collect) | 2,049 | 33% |
| Environment | 773 | 12% |
| Setup files | 512 | 8% |
| Prepare | 13 | 0.2% |

## Top families

A family is the module under test, or the base file name without dotted suffixes (Q43).

| Family | Files | Tests | Body s | Body % | Import s |
|---|---:|---:|---:|---:|---:|
| `src/views/WorldEditor.tsx` | 99 | 1,209 | 908.7 | 32.0 | 258.6 |
| `src/views/GameViewer.tsx` | 32 | 203 | 382.1 | 13.5 | 192.1 |
| `src/components/formaquestion/Formaquestion.tsx` | 28 | 417 | 160.9 | 5.7 | 150.6 |
| `src/views/MainMenu.tsx` | 16 | 177 | 119.4 | 4.2 | 92.7 |
| `src/components/modals/SettingsModal.tsx` | 21 | 215 | 83.3 | 2.9 | 103.4 |
| `src/components/game/GamePanels.tsx` | 27 | 435 | 51.2 | 1.8 | 78.2 |
| `src/components/formaquestion/FormaquestionMascotTab.tsx` | 3 | 132 | 79.5 | 2.8 | 13.7 |
| `src/components/community/RemoteWorldDetailsModal.tsx` | 15 | 163 | 15.7 | 0.6 | 70.8 |
| `src/views/CommunityCreationsBrowser.tsx` | 19 | 198 | 45.6 | 1.6 | 36.6 |
| `src/components/menu/PublishModal.tsx` | 9 | 112 | 16.1 | 0.6 | 48.1 |

**Slowest files by body time:** `GameViewer.bundledSaves` 96 s, `FormaquestionMascotTab` 69 s, `WorldEditor.authoringTour` 43 s, `GameViewer.turnRead` 41 s, `MainMenu.entry` 40 s.

## The ledger

[`npm run test:ledger`](../../../scripts/testLedger.mjs) writes one record per test to `<git common dir>/test-ledger/ledger.jsonl`, 31,851 in this run. Raw output stays there, untracked.

| Read it | Command |
|---|---|
| Stale records | `node scripts/testLedger.mjs --stale` |
| The report | `node scripts/testLedger.mjs --report` |
| Real-bug tests, one per line | `node scripts/testLedger.mjs --real-bug` |

| Level | Files | Tests |
|---|---:|---:|
| Unit | 862 | 20,961 |
| Component | 627 | 7,433 |
| View | 176 | 1,939 |
| Script | 53 | 946 |
| Scan | 27 | 572 |

> ⚠️ `scan` only means listed as always run. It is not a full list of scans, so ticket 14 still has to find the others itself.

- **Q5 areas:** scripts and sandbox 134 files, saves and migration 60, accounts and moderation 22, turn and prompts 19. These come from path and name words, so they can miss a file.
- **Module under test:** by name 1,631 files, only import 15, first import 90, none 9. Treat `first-import` as a guess.
- **Hash:** covers the test, its module and its direct test-only imports, including a snapshot file. It leaves out the rest of the import closure, so a change further down does not mark a record stale.

### Coverage

- 1,736 files in 838 s at 8 workers, with 0 errors and no hangs. The 44-file subset ran first and predicted 933 s.
- Median line coverage of the module under test is 83%, and the lowest tenth is at 43% or below. A module with several test files reads per file, so a low number can mean another file covers the rest.
- **9 files have no module, so no coverage:** `scripts/ciWorkflow`, `scripts/viteConfig`, `site/supporterTokens`, `src/components/ui/radixSingleCopy`, `src/lib/personaReaders`, `src/lib/playerInputRename`, `src/lib/viewportSizing`, `src/lib/worldSearchLabels`, `src/managers/fieldLabels`.

## Failure history

| Source | Read | Tests with a failure |
|---|---|---:|
| CI logs | 800 runs, 68 failed | 20 |
| Rerun records | 3 records, no artifact missing | 2 |
| Session transcripts | 5,077 files, 1,410 with a failure | 4,746 |

Transcript failures include work in progress, so they never count as real bugs (Q42).

### CI window

**Rule (b) could read CI from 2026-06-24 to 2026-11-02.** Of the 68 failed runs, 15 had logs that are gone, so it read 53. One more run's commit is not in this clone. A real CI catch in those runs is missing from the ledger.

### Real-bug history

**786 of 31,851 tests in 169 files, from 114 commits.** Each record names its rule and commit, so Q9 knows which bug to reinstate.

| Rule | Tests | How it decides |
|---|---:|---|
| (a) `fix-commit` | 784 | A commit with a `Fix` subject touches source and adds the test |
| (b) `ci-caught` | 2 | CI goes red on the test, and commits touch its module before the next green |

**Rule (a) over-includes on purpose (Q42).** A `Fix` commit can add tests for neighboring behavior, and all of them count. A false positive only keeps a test longer, while a miss could delete a real guard.

**Caught by CI:**

- `src/views/GameViewer.editorSaveError.test.tsx`: "Save & Exit on a full disk > shows the storage-full message instead of closing silently", `9a635b593`.
- `src/views/MainMenu.ageGate.test.tsx`: "the age gate in front of Community Creations > opens an external listing only after acceptance and consumes its target", `f794666f9`.

### Repeat offenders in CI

| File | CI runs | Last seen |
|---|---:|---|
| `src/views/CommunityCreationsBrowser.contest.test.tsx` | 7 | 2026-09-14 |
| `src/components/modals/SettingsModal.reasoning.test.tsx` | 5 | 2026-09-20 |
| `scripts/bundledRevisions.test.ts` | 4 | 2026-10-27 |

[CI Failures](ci-failures.md) has the causes and the rest of the list.

<details>
<summary>Real-bug tests by file</summary>

| File | Tests | Commits |
|---|---:|---|
| `src/contexts/GameDataContext.test.tsx` | 61 | 5285f858a 7a09a3038 |
| `src/lib/statRequest.test.ts` | 36 | b7e79fa52 |
| `src/lib/stripMarkdown.test.ts` | 24 | 487ea4ca8 |
| `src/lib/saveCompat.test.ts` | 19 | e1734caa6 024038c3c |
| `src/lib/contextLength.test.ts` | 17 | aecc1dbf5 |
| `src/lib/aiRequest/aiStream.test.ts` | 16 | c9ab17f24 de30c4576 bba69e118 |
| `src/lib/imageEndpointPresets.test.ts` | 16 | 83841ac7f 978e2d66e |
| `src/lib/statBar.test.ts` | 15 | b64c48ad8 |
| `src/lib/docs/bundledDocsIndex.test.ts` | 14 | 585db2158 |
| `src/lib/aiRequest/toolLoop.test.ts` | 13 | 04d6db0c3 50ec9d4d1 |
| `src/lib/aiResponse.test.ts` | 13 | 04d6db0c3 07e9efe1b |
| `src/lib/ttsChunks.test.ts` | 13 | 487ea4ca8 |
| `src/lib/worldSearchLabels.test.ts` | 13 | 49785d5a8 |
| `src/components/game/GamePanels.test.tsx` | 12 | d36dade13 694ea5a60 c13fcb237 8119e17cd |
| `src/lib/statChanges.test.ts` | 12 | 395bc5bb7 |
| `src/lib/locationMatch.test.ts` | 11 | 395bc5bb7 |
| `src/lib/imageGen/comfyui.test.ts` | 10 | 261852b66 74d526f5e |
| `src/components/game/RequestAnatomyView.test.tsx` | 9 | 1e356eac7 |
| `src/components/modals/UpdateDialog.test.tsx` | 9 | 46f8486ba b328e5610 |
| `src/lib/endpointUrl.test.ts` | 9 | b8ea538a1 |
| `src/lib/turnHistory.test.ts` | 9 | 2f93c385b c13fcb237 |
| `src/views/WorldEditor.equipment.test.tsx` | 9 | a7b8edd04 |
| `src/components/game/GamePanels.entityStats.test.tsx` | 8 | f50f89a36 e6b03611c c13fcb237 |
| `src/lib/aiRequest/responseSchema.test.ts` | 8 | 04d6db0c3 |
| `src/lib/entityMatch.test.ts` | 8 | b8ea538a1 |
| `src/lib/imageGen/fileName.test.ts` | 8 | 261852b66 74d526f5e |
| `src/lib/scriptNameDrift.test.ts` | 8 | 271ad9e64 |
| `src/lib/testBench/rules.test.ts` | 8 | fa5e79eda 97d7049d6 |
| `src/lib/turnBanding.test.ts` | 8 | bb9d1ee08 42695a418 |
| `src/components/menu/feedbackInlineFailures.test.tsx` | 7 | 5b75e28df |
| `src/lib/docs/scriptSurfaceGuides.test.ts` | 7 | 585db2158 |
| `src/lib/jsonFileOps.test.ts` | 7 | 0d24fe4b1 |
| `src/lib/placeholders.test.ts` | 7 | b8ea538a1 |
| `src/lib/statDescriptors.test.ts` | 7 | 7b8297c81 |
| `src/lib/updates/updateState.test.ts` | 7 | b328e5610 364cd84d7 |
| `src/services/AuthService.test.ts` | 7 | b5579be21 |
| `src/lib/bubbleActions.test.ts` | 6 | c13fcb237 d19d23d1b |
| `src/lib/libraryOrganization/operations.test.ts` | 6 | 575b061da |
| `src/lib/useDeviceDownload.test.tsx` | 6 | e11693b87 |
| `src/lib/worldImport.test.ts` | 6 | 6e8cc9eea |
| `src/lib/worldSearch.test.ts` | 6 | abb1b07cb 35592bb27 |
| `src/components/game/InventoryTab.equipped.test.tsx` | 5 | b077463ed |
| `src/components/modals/LoadGameDialog.test.tsx` | 5 | c13fcb237 |
| `src/lib/aiRequest/aiRequestSpec.test.ts` | 5 | c9ab17f24 261852b66 |
| `src/lib/extraParams.test.ts` | 5 | 261852b66 |
| `src/lib/publishPayload.test.ts` | 5 | b8ea538a1 |
| `src/lib/sectionStyle.test.ts` | 5 | c9474e123 |
| `src/lib/statCodeTemplates.test.ts` | 5 | cbc1a0080 d652f18e7 5c232c59c |
| `src/lib/statCodeTurn.fields.test.ts` | 5 | e167f8585 |
| `src/lib/useEndpointTip.test.tsx` | 5 | 261852b66 |
| `src/components/design-system/NarrationTurnReference.test.tsx` | 4 | c13fcb237 |
| `src/components/game/ExternalLinkDialog.test.tsx` | 4 | 0e747a5ef |
| `src/components/game/GamePanels.chatChoices.test.tsx` | 4 | c13fcb237 562b25a94 |
| `src/components/prompt/PromptField.headers.test.tsx` | 4 | 40168a332 d54a9953b |
| `src/components/prompt/promptFieldState.test.ts` | 4 | d54a9953b |
| `src/components/ui/multi-select.test.tsx` | 4 | 84dab617f |
| `src/lib/codeCards.world.test.ts` | 4 | a4bd72913 |
| `src/lib/entityGroupTree.test.ts` | 4 | 44621051b d92f2a70b |
| `src/lib/formaquestion/worldIndex.test.ts` | 4 | d7f28c283 |
| `src/lib/savedReasoning.test.ts` | 4 | 07e9efe1b |
| `src/lib/statCodeAnalysis.test.ts` | 4 | 5779bbd2c df5ce5ad1 |
| `src/lib/statCodeBoxOptions.test.ts` | 4 | a4bd72913 |
| `src/lib/statCodeExecutor.test.ts` | 4 | 9b4d7e6cb |
| `src/lib/statCodeTraits.test.ts` | 4 | e167f8585 |
| `src/lib/traitEffects.test.ts` | 4 | 8119e17cd |
| `src/lib/useCachedThumbnail.test.tsx` | 4 | c79ace2ab |
| `src/lib/useDeferredSnapshot.test.tsx` | 4 | 2f93c385b 9b4d7e6cb |
| `src/views/GameViewer.editorExit.test.tsx` | 4 | e949580e7 |
| `src/views/WorldEditor.statDescriptorRename.test.tsx` | 4 | 7b8297c81 |
| `src/components/formaquestion/Formaquestion.worldSource.test.tsx` | 3 | e98092ac1 |
| `src/components/game/DemoAINotice.test.tsx` | 3 | 1f74574a8 |
| `src/components/game/GamePanels.chatActions.test.tsx` | 3 | c13fcb237 |
| `src/components/game/GamePanels.pagesCard.test.tsx` | 3 | c13fcb237 |
| `src/components/game/MarkdownRenderer.timing.test.tsx` | 3 | 6a38e1e68 b0f773b7e |
| `src/components/modals/dbUtils.test.ts` | 3 | f489f79b7 |
| `src/components/modals/MemoryManagerModal.reset.test.tsx` | 3 | 364cd84d7 |
| `src/components/prompt/ChipDrag.test.tsx` | 3 | cdac55983 |
| `src/components/prompt/PromptField.affixes.test.tsx` | 3 | d54a9953b cdac55983 |
| `src/lib/aiRequest/extraParamsWarning.test.ts` | 3 | 261852b66 |
| `src/lib/inventory/pass.test.ts` | 3 | a7b8edd04 |
| `src/lib/memoryUtils.test.ts` | 3 | 07e9efe1b aecc1dbf5 |
| `src/lib/probeBackoff.test.ts` | 3 | a81221c6c |
| `src/lib/sceneImages.test.ts` | 3 | a1b44ca4c |
| `src/lib/statCodeExecutor.randomSeed.test.ts` | 3 | 5920832af |
| `src/lib/statCodeRename.entities.test.ts` | 3 | 271ad9e64 |
| `src/lib/statCodeRename.owners.test.ts` | 3 | 271ad9e64 |
| `src/lib/statCodeTurn.itemScripts.test.ts` | 3 | fe698b8d4 |
| `src/lib/statCodeTurn.owners.test.ts` | 3 | 9906359c1 |
| `src/lib/statCodeTurn.test.ts` | 3 | e167f8585 9b4d7e6cb |
| `src/lib/updates/updateDialogTitle.test.ts` | 3 | 46f8486ba 8cd9ce339 |
| `src/views/WorldEditor.autoSave.test.tsx` | 3 | e949580e7 |
| `src/views/WorldEditor.locationDelete.test.tsx` | 3 | 7a09a3038 |
| `src/views/WorldEditor.savedElsewhere.test.tsx` | 3 | e949580e7 |
| `src/components/menu/AuthModals.profile.test.tsx` | 2 | ac6ece0d7 |
| `src/components/menu/MyFeedbackTab.test.tsx` | 2 | 694ea5a60 |
| `src/components/modals/LocalModelModal.moveCopy.test.tsx` | 2 | 30730c67c |
| `src/components/modals/PresetShareDialogs.test.tsx` | 2 | 30730c67c |
| `src/components/modals/promptReasoningField.test.ts` | 2 | c9ab17f24 |
| `src/components/modals/StatCodeTemplateDialog.test.tsx` | 2 | 5c232c59c d652f18e7 |
| `src/components/modals/TextEndpointEditor.test.tsx` | 2 | 261852b66 |
| `src/components/prompt/PlaceholderPaletteBar.test.tsx` | 2 | 8491c3577 |
| `src/components/prompt/VariableNode.label.test.tsx` | 2 | d54a9953b |
| `src/contexts/GameplayContext.rewindEntities.test.tsx` | 2 | c13fcb237 |
| `src/contexts/SettingsContext.contextDetect.test.tsx` | 2 | a81221c6c |
| `src/hooks/useUpdateChecker.test.ts` | 2 | b328e5610 |
| `src/lib/aiRequest/rejectedOverride.test.ts` | 2 | 261852b66 |
| `src/lib/choices.test.ts` | 2 | bb9d1ee08 |
| `src/lib/droneWorld.test.ts` | 2 | c97850818 |
| `src/lib/formaquestion/helpSession.face.test.ts` | 2 | 50ec9d4d1 |
| `src/lib/imageGen/invokeai.test.ts` | 2 | 3fbd4c2f3 |
| `src/lib/inventory/inventory.test.ts` | 2 | fe698b8d4 |
| `src/lib/outputLength.test.ts` | 2 | 42695a418 |
| `src/managers/DictionaryBookManager.test.tsx` | 2 | ceea90492 |
| `src/views/WorldEditor.appBar.test.tsx` | 2 | e949580e7 |
| `src/views/WorldEditor.tourDictionary.test.tsx` | 2 | 57d6b27f2 7b8297c81 |
| `electron/modelMove.test.mjs` | 1 | a6ce39d2a |
| `scripts/fetchLlamaServer.test.mjs` | 1 | 60796dfbf |
| `site/components/SiteAgeGate.test.tsx` | 1 | 7e6a183e3 |
| `site/pages/CommunityPage.test.tsx` | 1 | b29fad3b5 |
| `src/components/editor/useSaveStatus.test.ts` | 1 | e949580e7 |
| `src/components/EditorRow.test.tsx` | 1 | 75204e1e9 |
| `src/components/formaquestion/Formaquestion.mascot.test.tsx` | 1 | 50ec9d4d1 |
| `src/components/game/ChoiceRows.reveal.test.tsx` | 1 | bb9d1ee08 |
| `src/components/game/ToolRoundsView.test.tsx` | 1 | d7f28c283 |
| `src/components/game/TTSModal.test.tsx` | 1 | c13fcb237 |
| `src/components/library/LibraryTileGrid.filter.test.tsx` | 1 | 575b061da |
| `src/components/MarkdownPanel.swap.test.tsx` | 1 | 2b92c15df |
| `src/components/menu/FeedbackThreadView.links.test.tsx` | 1 | 43aac7eec |
| `src/components/modals/DictionaryEditorModal.entryTabs.test.tsx` | 1 | ceea90492 |
| `src/components/modals/LicensesPanel.test.tsx` | 1 | 6a602e33b |
| `src/components/NavRail.test.tsx` | 1 | 0fb2141f3 |
| `src/components/prompt/CodeArea.guide.test.tsx` | 1 | a4bd72913 |
| `src/components/prompt/CodeArea.test.tsx` | 1 | ca6a1645b |
| `src/components/prompt/PlaceholderField.values.test.tsx` | 1 | 402f37602 |
| `src/components/ui/breadcrumb-picker.test.tsx` | 1 | 424154a05 |
| `src/components/ui/dialog.test.tsx` | 1 | 8e8a7b2ed |
| `src/components/ui/shielded-layer.test.ts` | 1 | 8dfb8c36f |
| `src/contexts/GameDataContext.savedElsewhere.test.tsx` | 1 | e949580e7 |
| `src/contexts/GameDataContext.saveQueue.test.tsx` | 1 | e949580e7 |
| `src/lib/aiRequest/aiText.test.ts` | 1 | c9ab17f24 |
| `src/lib/aiRequest/requestTransport.test.ts` | 1 | 04d6db0c3 |
| `src/lib/backup.save.test.ts` | 1 | 0d24fe4b1 |
| `src/lib/chatReadingLine.test.ts` | 1 | c13fcb237 |
| `src/lib/entityFile.test.ts` | 1 | ee611dc83 |
| `src/lib/formaquestion/playerView.test.ts` | 1 | 268e1a00e |
| `src/lib/idb.test.ts` | 1 | 396a273fd |
| `src/lib/mapBackground.test.ts` | 1 | 2cfa8eb88 |
| `src/lib/promptEndpoints.test.ts` | 1 | 261852b66 |
| `src/lib/saveOrdering.test.ts` | 1 | 75204e1e9 |
| `src/lib/statCodeAnalysis.entities.test.ts` | 1 | e167f8585 |
| `src/lib/statCodeAnalysis.persona.test.ts` | 1 | e167f8585 |
| `src/lib/testBench/scriptCheck.test.ts` | 1 | 9b4d7e6cb |
| `src/lib/thumbnailCache.test.ts` | 1 | 30730c67c |
| `src/lib/traitGates.test.ts` | 1 | 0931c9946 |
| `src/lib/traitTree.test.ts` | 1 | 44621051b |
| `src/lib/turnDigest.test.ts` | 1 | bb9d1ee08 |
| `src/lib/UtilityComponents.imageUrl.test.tsx` | 1 | 9fe0caf05 |
| `src/lib/worldLibrary.test.ts` | 1 | 396a273fd |
| `src/managers/StatManager.testCode.test.tsx` | 1 | d652f18e7 |
| `src/services/WorldStorageService.test.ts` | 1 | e949580e7 |
| `src/views/EnterWorldWorkspace.test.tsx` | 1 | 0fb2141f3 |
| `src/views/entityPanelTabs.test.ts` | 1 | 76f776f97 |
| `src/views/GameViewer.editorSaveError.test.tsx` | 1 | 9a635b593 |
| `src/views/GameViewer.scriptPrompts.test.tsx` | 1 | c13fcb237 |
| `src/views/MainMenu.ageGate.test.tsx` | 1 | f794666f9 |
| `src/views/MainMenu.surfaceRequest.test.tsx` | 1 | 40346d245 |
| `src/views/WorldEditor.findFocus.test.tsx` | 1 | 4a22da387 |
| `src/views/WorldEditor.tabNavigation.test.tsx` | 1 | 0fb2141f3 |
| `src/views/WorldEditor.worldAvatars.test.tsx` | 1 | 5c833fa01 |

</details>
