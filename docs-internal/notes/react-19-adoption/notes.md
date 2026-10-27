# React 19 Adoption Survey

Status: needs-triage

Survey date: 2026-10-24. Baseline: the "Upgrade to React 19" commit from `claude/spike-react-19-bedf56` (`react` / `react-dom` ^19.3.1). That commit adopts no new APIs. This note lists where the new APIs would help. Each "do" or "later" row is its own effort.

Source for API facts: React's `CHANGELOG.md` on `main` (19.2.0 and 19.3.0 sections), read 2026-10-24.

## 🏁 Ranking

| # | API | Value | Effort | Risk | Call |
|---|---|---|---|---|---|
| 1 | `useEffectEvent` | Removes ~20 `exhaustive-deps` disables and fixes 8 live warnings | S–M | Low | ✅ Do |
| 2 | Ref cleanup functions | Drops the held-observer workaround in 2 hooks | XS | Low | ✅ Do (with #1) |
| 3 | `<ViewTransition>` | Could replace hand-rolled FLIP and slide code | M–L | Medium | ⏳ Later, prototype first |
| 4 | `<Activity>` | Keeps tab state across switches; replaces `forceMount` + `hidden` hacks | M | Medium | ⏳ Later, needs a product call |
| 5 | Actions / `useActionState` / `useOptimistic` | Removes hand-rolled pending flags in ~44 files | M (spread) | Low–Medium | ⏳ Later, when a dialog is touched |
| 6 | Ref as a prop / Context as provider | Less boilerplate | L (sweep) | Low | ❌ Skip the sweep; new code only |
| 7 | Fragment refs | No clean fit found | — | — | ❌ Skip |
| 8 | `use()` | No Suspense data fetching to feed | — | — | ❌ Skip |
| 9 | Performance tracks | Does not reach the model-load stall | — | — | ❌ Skip for the stall |

## 1. `useEffectEvent` (19.2) ✅

**Benefit:** an effect fires only on the values that matter and still reads the latest callback, with no lint suppression.

**Sites.** The non-test `eslint-disable … exhaustive-deps` lines are all the "fire on X, read the latest Y" shape:

| Site | What the effect skips |
|---|---|
| [useResetOnOpen.ts:16](src/lib/useResetOnOpen.ts:16) | `reset` (shared hook, many callers) |
| [useSettingsOpenRequest.ts:18](src/lib/useSettingsOpenRequest.ts:18) | `open` |
| [useSurfaceOpenRequest.ts:25](src/lib/surface/useSurfaceOpenRequest.ts:25) | `open` |
| [GameViewer.tsx:496](src/views/GameViewer.tsx:496) | session preset helpers |
| [GameViewer.tsx:1533](src/views/GameViewer.tsx:1533) | autosave reads latest settings on a new turn |
| [GameViewer.tsx:3236](src/views/GameViewer.tsx:3236) | `sendGameAction` after a re-generate |
| [LikePrompt.tsx:95](src/components/game/LikePrompt.tsx:95) | callbacks during the listing read |
| [RemoteWorldDetailsModal.tsx:359](src/components/community/RemoteWorldDetailsModal.tsx:359), [:369](src/components/community/RemoteWorldDetailsModal.tsx:369) | reset on open |
| [LocationCanvas.tsx:1619](src/managers/LocationCanvas.tsx:1619) | `morph` identity |
| [EditorFindBar.tsx:217](src/components/editor/EditorFindBar.tsx:217), [:244](src/components/editor/EditorFindBar.tsx:244) | — |
| [SettingsModal.tsx:277](src/components/modals/SettingsModal.tsx:277), [:549](src/components/modals/SettingsModal.tsx:549) | — |
| [FeedbackThreadView.tsx:104](src/components/menu/FeedbackThreadView.tsx:104), [ManageUsersTab.tsx:292](src/components/menu/ManageUsersTab.tsx:292), [PublishModal.tsx:398](src/components/menu/PublishModal.tsx:398) | — |
| [LocalEngineManager.tsx:53](src/components/LocalEngineManager.tsx:53), [FontTuneDialog.tsx:60](src/components/FontTuneDialog.tsx:60), [LocationModal.tsx:49](src/components/modals/LocationModal.tsx:49) | — |
| [TraitSelectionModal.tsx:98](src/views/TraitSelectionModal.tsx:98), [CommunityCreationsBrowser.tsx:364](src/views/CommunityCreationsBrowser.tsx:364), [DictionaryManager.tsx:88](src/managers/DictionaryManager.tsx:88) | — |
| [useAvatarThumbnails.ts:37](src/lib/useAvatarThumbnails.ts:37), [tutorials.ts:290](src/lib/tutorials.ts:290), [useMascotMotion.ts:111](src/components/formaquestion/useMascotMotion.ts:111), [useFolderZoom.ts:406](src/components/library/useFolderZoom.ts:406) | — |

Live `exhaustive-deps` warnings on `main` today (8, not 20):

- [GameplayContext.tsx:451](src/contexts/GameplayContext.tsx:451), [GameViewer.tsx:4860](src/views/GameViewer.tsx:4860): `setEntityFollowers`, `setMetEntities`
- [useEndpointReachable.ts:109](src/lib/useEndpointReachable.ts:109), [:121](src/lib/useEndpointReachable.ts:121): `mounted`
- [PlaceholderDetail.tsx:75](src/managers/PlaceholderDetail.tsx:75), [WorldDetailsManager.tsx:123](src/managers/WorldDetailsManager.tsx:123): `setTab`
- [CharacterCustomization.tsx:71](src/views/CharacterCustomization.tsx:71): `refreshLibrary`
- [EnterWorldWorkspace.tsx:123](src/views/EnterWorldWorkspace.tsx:123): `picksOf` (a `useMemo`, so not an effect event; fix the deps)

**Keep these as they are:**

- `useMemo` disables ([SettingsContext.tsx:704](src/contexts/SettingsContext.tsx:704), [PromptField.tsx:692](src/components/prompt/PromptField.tsx:692), [ChipInput.tsx:235](src/components/prompt/ChipInput.tsx:235)). Effect events work only inside effects.
- Mount-once scene setup in [VRMViewer.tsx:729](src/views/VRMViewer.tsx:729). That is a real "build once" effect.
- The ~82 render-time "latest value" refs (20 in [GameViewer.tsx](src/views/GameViewer.tsx), for example `sendGameActionRef` at [:4367](src/views/GameViewer.tsx:4367) and `buildDigestRequestRef` at [:2293](src/views/GameViewer.tsx:2293)). The turn pipeline and timers read them from async callbacks. Plugin 6.1+ forbids calling an effect event from an arbitrary closure, so these stay refs.

**Lint plugin.** The branch pins `eslint-plugin-react-hooks` ^5.1.0-rc.0. The latest is 7.1.1 (`npm view`). 6.1.0 adds the "no effect event in arbitrary closures" check, and 7.0.1 forbids passing one as a JSX prop. Bump it in the same effort. Enable `rules-of-hooks` and `exhaustive-deps` only: the 7.x recommended preset adds React Compiler rules that would flag every render-time ref write above.

**Effort / risk:** about 30 sites, each a small rewrite. The risk is a site where the omitted dep was a real dep. Each rewrite needs a test that the effect still fires once per trigger.

## 2. Ref cleanup functions (19.0) ✅

**Benefit:** a callback ref returns its own teardown, so the held observer and the unmount effect go away.

| Site | Today |
|---|---|
| [ChipInput.tsx:156](src/components/prompt/ChipInput.tsx:156) | Holds the `ResizeObserver` in a ref plus an unmount effect. Its comment says React 18 callback refs can't return cleanup |
| [useWheelScroll.ts:21](src/lib/useWheelScroll.ts:21) | Holds a `detach` ref |
| [useElementSize.ts:21](src/lib/useElementSize.ts:21), [promptLayout.ts:96](src/lib/promptLayout.ts:96) | Store the node in state, then attach in an effect. A ref with cleanup saves one render per mount. Optional |

**Effort / risk:** under an hour. A callback ref with cleanup must be stable (`useCallback`), or React detaches and attaches it on every render. Both hooks already are.

## 3. `<ViewTransition>` (19.3) ⏳

**Benefit:** the browser animates between two DOM states, so hand-written FLIP math and raised overlay frames could go.

**Support** (MDN browser-compat-data, `Document.startViewTransition`):

| Target | Support |
|---|---|
| Electron 42 (Chromium) | ✅ Chrome 111+ |
| Android WebView (Capacitor) | ✅ mirrors Chrome 111+. `minSdkVersion` is 24, so an old, never-updated WebView gets no animation |
| Firefox | ✅ 144+ |
| Safari / iOS | ✅ 18+ |

React applies the update with no animation where the API is missing, so the fallback is safe.

**Candidates, easiest first:**

| Site | Today | Fit |
|---|---|---|
| [DrillSlide.tsx:8](src/components/DrillSlide.tsx:8) | `animate-in` slide keyed by level | Good first trial |
| [useMorphFullscreen.ts:1](src/lib/useMorphFullscreen.ts:1) | FLIP enter/exit/reveal, 3 timings | Good: a shared-element morph is what view transitions do |
| Editor and game tab switches ([WorldEditor.tsx:1321](src/views/WorldEditor.tsx:1321), [GamePanels.tsx:290](src/components/game/GamePanels.tsx:290)) | Hard cut | New motion; needs a design call |
| [useFolderZoom.ts](src/components/library/useFolderZoom.ts) (410 lines) | Hand-tuned camera with raised frames and a reveal point | Last. Tuned behavior, high risk to regress |
| Request status glyphs | Motion loops (spec Q1) | ❌ Not a fit: loops are not state swaps |

**Caveats:**

- A view transition runs only for updates inside `startTransition`, `useDeferredValue` or Suspense. Each switch must move into a transition.
- The whole page freezes into a snapshot during the transition, so input lags for its length.
- Verify with Playwright frame sampling. The Browser pane does not composite.
- Reduced motion needs a CSS rule on `::view-transition-*`.
- A new visual pattern needs the user's approval (Design System rule).

## 4. `<Activity>` (19.2) ⏳

**Benefit:** a hidden tab keeps its DOM and state (scroll, expanded rows, half-typed search) and comes back without a remount.

**Unmount on hide today:**

- World Editor tabs render only the active body ([WorldEditor.tsx:1321](src/views/WorldEditor.tsx:1321)).
- In-game side tabs use Radix `TabsContent`, which unmounts inactive panels ([GamePanels.tsx:299](src/components/game/GamePanels.tsx:299)–376).
- `App` unmounts the main menu while a game runs ([App.tsx:186](src/App.tsx:186)), so the library board scroll and open folder reset on exit.

**Hand-rolled keep-alive** (`forceMount` + `data-[state=inactive]:hidden`, or `hidden=`):

- [FeedbackTab.tsx:28](src/components/menu/FeedbackTab.tsx:28), [MyFeedbackSection.tsx:33](src/components/menu/MyFeedbackSection.tsx:33), [AdminPanelDialog.tsx:186](src/components/menu/AdminPanelDialog.tsx:186)
- [UserProfileDialog.tsx:194](src/components/community/UserProfileDialog.tsx:194) (mounts once opened, then stays)
- [ToolEditor.tsx:614](src/components/modals/ToolEditor.tsx:614)
- [FeedbackQueueTab.tsx:41](src/components/menu/FeedbackQueueTab.tsx:41), [MyFeedbackTab.tsx:87](src/components/menu/MyFeedbackTab.tsx:87) (list hidden while a thread is open)

**Caveats:**

- A hidden Activity **runs its effect cleanups**. The VRM renderer in the **View** tab would still rebuild on every return. Activity keeps state, not live effects.
- Hidden trees still re-render at low priority when their props change. World Editor tabs that all read the world would re-render on each keystroke.
- 19.3 fixed portal contents and `useSyncExternalStore` inside hidden trees. Those fixes are on our version.

**Open question for the user:** should a tab keep its state when you leave it? That is a product call, not an implementation one. The hand-rolled sites above are a safe first step either way.

## 5. Actions, `useActionState`, `useOptimistic` (19.0) ⏳

**Benefit:** React tracks pending state and rolls back optimistic state, so the `isSending` / `try` / `finally` pattern goes.

- ~44 non-test files hold a hand-rolled `submitting` / `saving` / `pending` / `busy` flag. Examples: [ReportDialog.tsx:64](src/components/community/ReportDialog.tsx:64) with its submit at [:79](src/components/community/ReportDialog.tsx:79), [PublishModal.tsx](src/components/menu/PublishModal.tsx), [ChangelogEntryDialog.tsx](src/components/community/ChangelogEntryDialog.tsx), [FeedbackEditDialog.tsx](src/components/menu/FeedbackEditDialog.tsx), [AccountSettingsTab.tsx](src/components/menu/AccountSettingsTab.tsx).
- **Likes** are the one hand-rolled optimistic flow: [CommunityCreationsBrowser.tsx:669](src/views/CommunityCreationsBrowser.tsx:669) sets `optimisticLikeState`, then restores `before` on a refusal. `useOptimistic` fits, but the refusal branches (sign-in, cap, silent) stay as code.

**Effort / risk:** each dialog is small. The risk is timing: an action's updates now render as a transition, and 19.3 renders transitions independently. Adopt per dialog when it is touched, not as a sweep.

## 6. Ref as a prop, Context as provider (19.0) ❌ sweep

- `forwardRef`: 103 calls in 58 files. 27 files are in `src/components/ui/`, 14 in `src/views/`.
- `<X.Provider>`: about 50 opening tags, for example [PromptField.tsx:938](src/components/prompt/PromptField.tsx:938)–943 (six nested).
- **asChild is safe.** The installed `@radix-ui/react-slot` 1.4.0 reads `element.props.ref` first (`getElementRef` in its dist), so a ref-as-prop child still gets the ref. The list in [eslint.composed-forwardref.js](./eslint.composed-forwardref.js) keeps its meaning: "forwards its ref" holds either way.
- `forwardRef` still works in 19. The sweep is churn for no behavior change.

**Call:** new components take `ref` as a prop and use `<Context value>`. Convert old ones when a file is edited for another reason. Re-sync `src/components/ui/` from shadcn's React 19 sources as its own task if wanted.

## 7. Fragment refs (19.3) ❌

Only two `display: contents` wrappers hold a ref, and neither fits:

- [WorldEditor.tsx:1284](src/views/WorldEditor.tsx:1284) calls `.contains()`. A fragment instance has no `contains`.
- [ExternalLinkDialog.tsx:28](src/components/game/ExternalLinkDialog.tsx:28) stops React synthetic events that bubble through a portal. Fragment listeners are native, so they can't stop those.

## 8. `use()` (19.0) ❌

No component suspends on a promise today. `use(Context)` is only `useContext` with conditional calls. No gain without a Suspense data layer.

## 9. Performance tracks (19.2) ❌ for the stall

The model-load stall is GPU-side: frame gaps of 400–600 ms while weights upload, with JS lag under 20 ms on main and renderer (2026-10-23 probe). React's tracks show only React's scheduler and component work, so they would show nothing here.

They could help the narration streaming-lag trace instead, where React render cost is a candidate cause. They are on by default in a DEV build in Chrome DevTools.

## ▶ Resume here

Next step: the user triages rows 1–5. Rows 1 and 2 can land as one effort ("Adopt Effect Events").
