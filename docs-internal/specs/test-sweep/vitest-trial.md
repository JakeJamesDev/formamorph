# Vitest Trial

Vitest 3.2.6 on Vite 5.4.0 against Vitest 5.0.5 on Vite 8.3.5 with plugin-react 6.1.2. Both arms ran from clean clones of `0d740bf0d`, each with its own `node_modules`.

## Recommendation

**Adopt.** The upgrade clears the Q31 bar. All failures trace to test code or the test environment, and neither the trial nor the adoption checks found a product bug or build break.

| Q31 check | Result |
|---|---|
| Affected-gate median improves by ≥10% and more than run spread | ✅ 22–26% on all three change sets |
| Full-suite median improves by ≥10% and more than run spread | ✅ 10.8% warm, ❌ 0% cold |
| No product bug | ✅ None found |
| No build break | ✅ None after a plugin fix. Chromium and Electron load the builds |

**Owner decision:** adopt, 2026-11-01.

## Times

Each arm ran three alternating warm passes. Times are wall seconds, median, with the run spread in brackets.

| Run | Files (current → 5) | Current | Vitest 5 | Change |
|---|---|---:|---:|---:|
| Full suite, warm | 1,717 | 361 (12) | 322 (9) | −10.8% |
| Full suite, cold (one run) | 1,717 | 362 | 362 | 0% |
| Affected gate, lib `615c57b3e` | 735 → 689 | 310 (12) | 241 (32) | −22% |
| Affected gate, view `56775cdf6` | 173 | 168 (2) | 127 (2) | −24% |
| Affected gate, path trigger `ca8d4235f` | 117 → 121 | 133 (1) | 98 (1) | −26% |

**What the numbers mean:**

- **The gain is import time.** On the 1,708 files green on both arms, summed warm test time changes by only 2% (2,621 s → 2,572 s). The gain needs a warm module cache, so a cold run gains nothing.
- **The lib gate is not like for like.** Vitest 5 selects 46 fewer files. The view gate has the same selection on both arms.

**Excluded files:** the 1,708-file sum excludes 9 files that are red on Vitest 5. Wall times include them because the runs had no green-only arm. This counts against Vitest 5: the 9 files take about 180 s of test time there and about 138 s on current. The gate times carry the same bias, with 5 red files in lib, 3 in view and 1 in path trigger.

**One gap:** the path-trigger gate ran 117 files on current, but the Node API read for the same change listed 122. I did not explain the difference.

### Load conditions

- 32 logical cores, Node 24.18.0, default workers.
- The owner gave the AFK signal through the spec session, and the time box of one working session plus one AFK window held for the trial runs. The adoption checks ran after it.
- All 27 recorded runs show no prepare lock and no peer Vitest process. No run needed a repeat.
- CPU was 35–65% during runs. A calibration loop stayed at 0.26–0.33 ms.
- `doll-cleanup — spec` was the one busy session at the first start. The session listing at the end showed none busy, with 3 sessions not listed.
- The app closed about 4 minutes into the first attempt. That attempt recorded no result. The owner then restarted the session, so the runs started at 14:34 and may overlap some owner activity at the start.

## Failures

The full suite on Vitest 5 has **23 failed tests in 9 files** and **84 unhandled errors**, the same 23 tests in all four full runs. Current has none.

| Cause | Tests | Proof | Fix | Estimate |
|---|---:|---|---|---:|
| Object-URL stub skipped: `FormaquestionMascotTab`, `useCachedThumbnail` | 10 | ✅ Pass with the fix | Install the stub in `src/test/setup.ts` whenever `window` exists | 15 min |
| Test replaces `URL` with a plain object: `useVrmSourceUrl` | 4 | ✅ Pass with the fix | Spy on `URL.createObjectURL` | 5 min |
| A step ends before the tick message arrives: `WorldEditor.history`, `.fieldHistory`, `.historyReveal` | 5 | ✅ Pass with the fix | Wait for a macrotask at the end of `step` | 30 min |
| A re-spy keeps its call history: `statCodeExecutor.descriptor` | 2 | ✅ Pass with the fix | `mockClear` in `readSelf` | 5 min |
| A mock return carries over from an earlier test: `MyFeedbackTab` | 1 | ✅ Pass with the fix | Reset the user in `beforeEach` | 10 min |
| Spy wrapper calls itself: `worldLibrary` | 1 | ✅ Pass with the fix | Chain through the existing spy's implementation | 30 min |

### The unhandled errors

The capped run reported 85 errors. Full runs report 84 or 85. Every one is the same `TypeError: The "obj" argument must be an instance of Blob`.

| Thrown at | Count | Test file running |
|---|---:|---|
| [useMascotImageUrls.ts:31](../../../src/components/formaquestion/useMascotImageUrls.ts:31) | 78 | `FormaquestionMascotTab` |
| [useVrmSourceUrl.ts:32](../../../src/lib/useVrmSourceUrl.ts:32) | 5–6 | `MainMenu.entry` |
| [useVrmSourceUrl.ts:32](../../../src/lib/useVrmSourceUrl.ts:32) | 1 | `MainMenu.landing` |

**Cause:** Vitest 3 leaves `URL.createObjectURL` undefined in jsdom, so [setup.ts:132](../../../src/test/setup.ts:132) installs a stub that accepts anything. Vitest 5 defines the method, so the stub stays out, and Node's version rejects any value that is not a Blob. The tests hand it a plain object. I did not trace where that object comes from.

**Ruling: migration cost, all of them.** With the stub always installed, all five files pass (186 tests) with zero unhandled errors. In production these paths get a real Blob from the browser. This is the same fix as the first table row, so it needs no extra time.

## Selection (`recordDependencies`)

This section does not count toward the time bar. `experimental.recordDependencies` needs one full run to record. That run took 329 s, against 322 s without it.

| Change set | Current static | Vitest 5 static | Vitest 5 recorded |
|---|---:|---:|---:|
| Lib `615c57b3e` | 735 | 689 | 668 |
| View `56775cdf6` | 173 | 173 | 173 |
| Path trigger `ca8d4235f` | 122 | 121 | 121 |

**Selection changed on two of three sets. No test was added, and I found no real miss.** To check, I broke each changed file and ran every dropped test on the Vitest 5 arm:

- `imageBytes.ts` with a throw at load: 0 of 67 dropped files noticed.
- `emberwatch.json` as invalid JSON: 0 of 1 dropped file noticed.
- Control: the same breakage fails `imageBytes.lossless` and `emberwatchWorld`, which selection keeps.

This check catches a test that loads the changed file. It does not cover a test that depends on the file through a mock.

**Recorded selection skips `fs` reads.** The path triggers in `scripts/testSelection.mjs` must stay either way.

**Setup-file cleanup stays out of the walk.** A change to `eventsCache` or `listingDetailsCache` can fail every jsdom test's cleanup, but the gate selects only those files' own importers. Vitest 3 does not walk setup files, so this is the same reach as today. CI's full run catches it.

**My recommendation is to leave recording off.** It is experimental and saves 21 files on one of three sets. A static walk needs no recording run.

<details>
<summary>Dropped test files</summary>

**Path trigger, dropped by both static and recorded on Vitest 5 (1):** `src/lib/defaultWorlds.test.ts`

**Lib, dropped by recorded only (21):**
`site/App`, `site/components/SiteAgeGate`, `site/pages/FeedbackPage.filing`, `site/pages/FeedbackPage`, `src/components/ErrorDetailsReportBug`, `src/components/ThemedToastContainer`, `src/components/design-system/ContextMenuReferences`, `src/components/design-system/MainMenuContextMenuReference`, `src/components/formaquestion/useHelpAi`, `src/components/menu/EventsTab`, `src/components/menu/ServerSettingsTab`, `src/components/modals/ImageSetupGuide`, `src/components/modals/UpdateRequiredDialog`, `src/contexts/AccountDeletionContext`, `src/lib/aiRequest/aiRequestFailureToast`, `src/lib/aiRequest/rejectedOverrideNotice`, `src/lib/dev/devFeedbackStub`, `src/lib/eventsCache`, `src/lib/useActiveEvents`, `src/lib/useContests`, `src/managers/PlaceholderManager`

**Lib, dropped by static and recorded on Vitest 5 (46):**
`site/pages/ProfilePage`, `src/components/AiGenerateButton`, `src/components/AiSetupGate`, `src/components/editor/CodeRenameOffer`, `src/components/game/TTSModal`, `src/components/game/useLikePrompt`, `src/components/menu/AccountSettingsTab.patreon`, `src/components/menu/AdminPanelDialog`, `src/components/menu/ManageUsersTab`, `src/components/menu/UpdateVersionControl`, `src/components/modals/EndpointReachabilityBadge`, `src/components/modals/EndpointRouteField`, `src/components/modals/LoadGameDialog`, `src/components/modals/LocationModal`, `src/components/modals/MemoryManagerModal.regenerate`, `src/components/modals/MemoryManagerModal.reset`, `src/components/modals/MemoryManagerModal.search`, `src/components/modals/UpdateDialog`, `src/lib/useAiReachable`, `src/lib/useAvatarThumbnails`, `src/lib/useBodyMorphNames`, `src/lib/useCatalogSync.commits`, `src/lib/useCatalogSync`, `src/lib/useDownloadCoordinator`, `src/lib/useEntityGallery`, `src/lib/useEntityVisualPreference`, `src/lib/useLocationBackdrop`, `src/lib/useScriptWorldNames`, `src/lib/useTagHistory`, `src/lib/useVrmSourceUrl`, `src/lib/useWorldDownloadPlan`, `src/lib/useWorldExport`, `src/managers/DictionaryManager`, `src/managers/GroupManager`, `src/managers/LocationConnections`, `src/managers/PlaceholderCopyEditor`, `src/managers/PlaceholderManager.rename`, `src/managers/SortableTree`, `src/managers/StatGroupManager`, `src/managers/StatManager.bodySliders`, `src/managers/StatManager`, `src/managers/StatManager.testCode`, `src/managers/TraitManager.rename`, `src/managers/TraitManager`, `src/managers/WorldDetailsManager.chipOptions`, `src/managers/WorldDetailsManager`

All names are test files, with `.test.ts` or `.test.tsx` left off.

</details>

## Migration cost

**About 5 hours in total.** These are my estimates, not measurements. The trial proved the code changes below on its own arm, but never ran them all together in one full run.

| Item | Detail | Estimate |
|---|---|---:|
| Test fixes | The 23 failures above | 1.5 h |
| Dependencies | `vitest`, `@vitest/coverage-v8`, `vite`, `@vitejs/plugin-react`. Remove them, then reinstall, because the locked esbuild 0.21.5 conflicts with Vite 8's optional peer. The lock also gains Rolldown and lightningcss | 15 min |
| `vite-node` | Vitest 5 no longer brings it, and 7 `package.json` scripts need it. Add it as a direct dependency | 5 min |
| `esbuild` | Vite 8 no longer brings it, and 11 `testing/baseline/harness/` scripts import it. Add `esbuild@^0.28.2`, which Vite 8's optional peer range accepts | 5 min |
| `engines` | Raise from `>=20.19` to `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | 5 min |
| [vite.config.js](../../../vite.config.js) | Add `apply: 'serve'` and `moduleType: 'js'` to the `cacheTypesCjs` plugin. Without them the production build stops on a parse error | 5 min |
| Vite warnings | `inlineDynamicImports` is deprecated, and `configLoader: 'native'` warns on `__dirname` and an extensionless import | 15 min |
| Selection walk | Vitest 5 walks setup files, dynamic imports included. Two cleanup imports in `src/test/setup.ts` made a lib change select all 1,717 files, so the walk must not see them | 15 min |
| Build checks | Compare app and site output, run in a browser, run Electron and Android | 2 h |
| Shared `node_modules` | Every worktree uses a junction to it, so all open tickets change toolchain at landing. Land in a quiet window. Vitest 5's module cache would also be shared across worktrees, which I did not test | Owner's call |

### Node versions

- `.nvmrc` is 24, and `ci.yml`, `pages.yml` and `release.yml` all read it. That covers the Android and desktop release jobs.
- The Cloudflare jobs in `release.yml` deploy a web build made elsewhere: the `web` job's artifact or the latest release zip. They build nothing with their own Node.
- **UNVERIFIED:** Cloudflare dashboard build settings are not in the repo. I could not check them.

## Adoption checks

These ran after the owner's decision, on a clean clone of `0d740bf0d` with every fix in place.

**Full suite:** 1,716 files passed and 1 skipped, 31,270 tests passed and 15 skipped, 0 unhandled errors, 334 s. Current also skips 15. Five `ReturnType<typeof vi.fn>` mocks failed typecheck on Vitest 5, which the trial had not run. They now have call signatures, and typecheck is clean.

### Production builds

Both arms built with no `.env`.

| Build | Current | Vitest 5 |
|---|---|---|
| App | 30 s, 513 files, 117.94 MB, JS 57.24 MB | 10 s, 535 files, 118.02 MB, JS 57.31 MB |
| Site | 10 s, 349 files, 15.01 MB, JS 13.40 MB | 2 s, 361 files, 15.26 MB, JS 13.65 MB |

- **Non-code assets:** the same on both arms, with no size change.
- **Chunks:** Vite 8 splits out more shared chunks, so the app's `index.html` has 26 script and link tags against 6. The site has 15 against 7.
- **Image worker:** the encoder now sits inside `imageOptimWorker`. A 512 px WebP encode gives the same output length on both arms (7,127 characters).

### Run checks

| Check | Result |
|---|---|
| App build in Chromium, 3 fresh profiles per arm | ✅ No page errors, the same four 404s on both |
| Site build at `/site-app/`: `/login`, `/register` | ✅ Renders the same, no page errors on either arm |
| Electron shell on the app build | ✅ Main menu renders from `app://`, the desktop bridge is present, no page errors on either arm. Not packaged |
| Nine E2E specs, desktop | ✅ 28 passed, 25 failed, 6 skipped on **both** arms, with the same 25 failures. 8.5 min against 11.5 min |
| Android | ❌ Not run, needs the device |

## Also found

These exist at `0d740bf0d` on both arms. The upgrade does not cause them, and I did not fix them.

- **`npm run fingerprints`** fails with a `TypeError` at [mediaIndex.ts:181](../../../src/lib/mediaIndex.ts:181).
- **`npm run test:e2e`** loads 0 tests. Two spec-load errors stop the run: a `.webp` import from `authoring-tour.spec.ts`, and a JSON import from `wordlist-english`.
- **25 E2E tests fail** in the nine specs I ran. Most are in `formaquestion-mascot.spec.ts`. At least one expects old copy.
- **Default world order** changes between fresh profiles, because the worlds seed in parallel.
