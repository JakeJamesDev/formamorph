/**
 * Registry + running-tab for the DEV-only dev-router (see `devRouter.ts`). One source of truth for
 * which app locations the router can jump to, so verification can land somewhere in a single call
 * instead of a click-and-screenshot crawl. Extend this as each section lands.
 *
 * `DEV_VIEWS` is also App's `currentView` type — App imports it — so a new top-level view can't drift
 * from the router. `DEV_MODAL_TABS` is guarded in `devRouter.test.ts` against each surface's own exported
 * tab list, so adding a tab without covering it here fails the test.
 */

/** Top-level screens App can route to (App types `currentView` off this — single source of truth). */
export const DEV_VIEWS = ['mainMenu', 'gameViewer'] as const;
export type DevView = (typeof DEV_VIEWS)[number];

/** Modals the router can open via `#dev?modal=…`. `settings` opens from MainMenu or GameViewer; `menu`,
 *  `worldEditor` and `community` open from MainMenu; `entity`/`export` are in-game (GameViewer).
 *  `worldEditor` is an in-place modal on MainMenu (not a top-level view). `intro` replays the first-run
 *  welcome overlay on MainMenu. `localModel` is intentionally absent — it lives inside
 *  Settings→LocalModelPanel, reached via `modal=settings` + its tab, not its own name. `avatar` opens
 *  MainMenu's Character Customization step directly (a MainMenu sub-state, like `worldEditor`).
 *  `aiSetup` opens the AI setup gate on MainMenu in its skippable (first-run) form. `entityEditor` and
 *  `dictionaryEditor` are the *library* editors (MainMenu), distinct from the in-game `entity` modal; both
 *  open on a blank draft, so they're reachable without any stored data. `modelDetails` is the exception to
 *  that: a VRM preview has nothing to show without a stored model, so it opens the library's first model and
 *  does nothing on an empty library. `community` opens Community Creations from MainMenu. `memoryManager` is
 *  in-game (GameViewer) and opens on an empty ledger before any turn has been summarized. `profile` opens
 *  the account dialog (Messages/Manage), `feedbackHub` the reader's side of bugs and suggestions, and
 *  `adminPanel` the admin tools (Users/Broadcasts). All three need a signed-in session, and `adminPanel`
 *  an admin one, so they open empty otherwise rather than failing. `location` is in-game (GameViewer) and
 *  opens the Change Location dialog on whichever of its two views was used last, so pair it with `fixture=…`
 *  to have a world worth traveling in. `editText` is in-game (GameViewer) and
 *  opens the narration editor on the current page's text — empty before any turn, which is enough to reach
 *  its full-screen toggle, the one editor that grows in place instead of raising a window. `changelog` opens
 *  MainMenu's What's New popout on a canned sample (`devChangelogSample.ts`) rather than the live GitHub
 *  fetch, so its typography is checkable offline and always shows every shape the notes can take.
 *  `eventAck` opens the running-event acknowledge poster on a canned event (`devEventSample.ts`) instead of
 *  the events poll, so both it and the main menu's event banner are checkable without a live event; `tab=…`
 *  picks which phase, an opening or an ending. */
export const DEV_MODALS = ['settings', 'entity', 'export', 'menu', 'worldEditor', 'intro', 'avatar', 'backup', 'aiSetup', 'entityEditor', 'dictionaryEditor', 'modelDetails', 'community', 'memoryManager', 'profile', 'feedbackHub', 'adminPanel', 'editText', 'location', 'changelog', 'eventAck'] as const;
export type DevModal = (typeof DEV_MODALS)[number];

/** Coverage ledger: tabbed surface → the sub-tabs the router can target (via `tab=…`). Kept in lockstep
 *  with each surface's own exported tab list by `devRouter.test.ts`. Add a surface's tabs here when wired. */
export const DEV_MODAL_TABS = {
  settings: ['display', 'output', 'prompts', 'endpoints', 'data'],
  worldEditor: ['overview', 'stats', 'entities', 'locations', 'traits', 'dictionary', 'placeholders'],
  // Community Creations browses one kind per tab; these are the server's kinds (see lib/catalogKinds).
  community: ['world', 'entity', 'dictionary'],
  // The account dialog: admin messages, the follow feed, and the terms. Password and logout are header
  // buttons rather than tabs, so neither is routable.
  profile: ['messages', 'notifications', 'terms'],
  // The reader's side of feedback, behind the main menu's Feedback button; one tab per branch.
  feedbackHub: ['bugs', 'suggestions'],
  // The admin tools: accounts, broadcasts, the publish policies, the feedback queues, and the log.
  adminPanel: ['users', 'broadcasts', 'policies', 'feedback', 'log'],
  // The World Editor's Locations tab shows one of two views of the same locations, switched with `subtab=…`
  // (`#dev?modal=worldEditor&tab=locations&subtab=canvas`). Adding `fullscreen=1` opens the canvas in its
  // full-screen window on arrival — the same canvas, so it is not a third view and not listed as one.
  worldEditorLocations: ['list', 'canvas'],
  // The World Editor's Test Bench: `bench=…` opens the full panel — at whichever placement is remembered —
  // on the instrument it names (`#dev?modal=worldEditor&bench=issues`). Only built instruments are listed,
  // since an unbuilt tab renders
  // disabled and has nothing to land on, so adding one here is part of building it.
  worldEditorBench: ['issues', 'triggers', 'aiContext', 'opening'],
  // Admin Panel → Policies has a second level, one sub-tab per authored popup, reached with `subtab=…`.
  adminPanelPolicies: ['uploadGate', 'tagNotice'],
  // Admin Panel → Feedback uses the same `subtab=…` slot, one per branch.
  adminPanelFeedback: ['bugs', 'suggestions'],
  // The acknowledge poster renders one of an event's two phases; `tab=…` picks which the canned event is at.
  eventAck: ['start', 'end'],
  // MainMenu's library card-type switcher. Not a modal: reached with `tab=…` and no `modal=…`, i.e.
  // `#dev?view=mainMenu&tab=models`. Listed here so the same drift guard covers it.
  mainMenu: ['worlds', 'entities', 'dictionaries', 'models'],
  // GameViewer's side panel (Entities/Notes/Memory/Logs). Also not a modal: `#dev?view=gameViewer&tab=memory`.
  // The mobile-only `model` tab is deliberately not routable.
  gameViewer: ['entities', 'notes', 'memory', 'logs'],
} as const;

// Settings → Prompts exposes a second level reached via `subtab=…` (narration/thinking/choices/…). Those
// triggers render conditionally (thinking mode, enabled features), so they're not guarded as a fixed list.
// Admin Panel → Policies uses the same `subtab=…` slot, and its two are fixed, so they are guarded above.
// Mid-game boot fixtures live in `devFixtures.ts` (`DEV_FIXTURES`); reached via `bootFixture(name)`.
