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
 *  does nothing on an empty library. `community` opens Community Creations from MainMenu,
 *  in the modal the app raises; `mode=page` swaps it for the full-page shell a site entry would use.
 *  `memoryManager` is
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
 *  picks which phase, an opening or an ending. `publish` opens MainMenu's publish dialog on a canned world
 *  (`devPublishSample.ts`) and a canned running contest, so the dialog and the contest opt-in inside it are
 *  reachable on a profile with nothing published and no event really running. `worldPrompts` opens
 *  MainMenu's read-only Custom Prompts viewer; with no world selected it renders a canned sample
 *  override, so it's reachable on an empty library. `aiContext` is in-game (GameViewer) and opens the
 *  AI Context inspector — empty before any turn, so pair it with `fixture=…` for real captured turns.
 *  `ageGate` raises the community age attestation on demand, so its copy stays checkable on a profile
 *  that has already accepted it. `likers` opens Community Creations, its first listing's details, and the
 *  staff-only likers list on top — the same "first row in the library" trick `modelDetails` uses, since
 *  the list has nothing to show without a real listing. It needs a staff session and does nothing
 *  otherwise. `privacyPolicy` raises the sign-in privacy prompt on canned text
 *  (`devPrivacySample.ts`), because the real policy is a server row that ships switched off —
 *  without the sample the prompt would have nothing to render before the cutover.
 *  `deleteAccount` opens the account-deletion flow at its first step, and `deletionCancelled` the notice
 *  a sign-in raises when it calls a pending deletion off. Neither is reachable by clicking without an
 *  account in the matching state — one needs a real password, the other a request already standing. */
export const DEV_MODALS = ['settings', 'entity', 'export', 'menu', 'worldEditor', 'intro', 'avatar', 'backup', 'aiSetup', 'entityEditor', 'dictionaryEditor', 'modelDetails', 'community', 'memoryManager', 'profile', 'feedbackHub', 'adminPanel', 'editText', 'location', 'changelog', 'eventAck', 'publish', 'worldPrompts', 'aiContext', 'ageGate', 'likers', 'privacyPolicy', 'deleteAccount', 'deletionCancelled'] as const;
export type DevModal = (typeof DEV_MODALS)[number];

/** Coverage ledger: tabbed surface → the sub-tabs the router can target (via `tab=…`). Kept in lockstep
 *  with each surface's own exported tab list by `devRouter.test.ts`. Add a surface's tabs here when wired. */
export const DEV_MODAL_TABS = {
  settings: ['display', 'output', 'prompts', 'endpoints', 'data'],
  worldEditor: ['overview', 'stats', 'entities', 'locations', 'traits', 'dictionary', 'placeholders'],
  // Community Creations browses one kind per tab, plus Contest — a view over the worlds already in the
  // catalog rather than a fourth kind (see lib/browseTabs). `tab=contest` serves canned contests, so the
  // tab is reachable whether or not one is really running.
  community: ['world', 'entity', 'dictionary', 'contest'],
  // The account dialog: admin messages, the follow feed, and the terms. Password and logout are header
  // buttons rather than tabs, so neither is routable.
  profile: ['messages', 'notifications', 'terms'],
  // The reader's side of feedback, behind the main menu's Feedback button; one tab per branch.
  feedbackHub: ['bugs', 'suggestions'],
  // The admin tools: accounts, broadcasts, the publish policies, the events calendar, the feedback
  // queues, the report queue, and the log. `tab=events` serves a canned calendar (`devEventSample.ts`),
  // so the tab's three groups are reachable without a live server; which of its two role views appears
  // follows the session. `tab=reports` needs a live server with the feature — it opens empty otherwise.
  adminPanel: ['users', 'broadcasts', 'policies', 'events', 'feedback', 'reports', 'log'],
  // Admin Panel → Events uses the `subtab=…` slot for which of its two role views to render over the
  // canned calendar, so the moderator's read-only half is reachable without a second account.
  adminPanelEvents: ['admin', 'staff'],
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
  adminPanelPolicies: ['uploadGate', 'tagNotice', 'privacyPolicy'],
  // Admin Panel → Feedback uses the same `subtab=…` slot, one per branch.
  adminPanelFeedback: ['bugs', 'suggestions'],
  // The acknowledge poster renders one of an event's two phases; `tab=…` picks which the canned event is at.
  eventAck: ['start', 'end'],
  // MainMenu's library card-type switcher. Not a modal: reached with `tab=…` and no `modal=…`, i.e.
  // `#dev?view=mainMenu&tab=models`. Listed here so the same drift guard covers it.
  mainMenu: ['worlds', 'entities', 'dictionaries', 'models'],
  // Settings → Prompts has a THIRD level: which surface of the open prompt is on show, reached with
  // `surface=…` (`#dev?modal=settings&tab=prompts&subtab=narration&surface=anatomy`). `anatomy` is the
  // hub every prompt lands on, not an editor; the panel falls back to it wherever a surface doesn't apply.
  settingsPromptSurfaces: ['system', 'user', 'messages', 'options', 'anatomy'],
  // GameViewer's side panel (Entities/Notes/Memory/Logs). Also not a modal: `#dev?view=gameViewer&tab=memory`.
  // The mobile-only `model` tab is deliberately not routable.
  gameViewer: ['entities', 'notes', 'memory', 'logs'],
} as const;

// Settings → Prompts exposes a second level reached via `subtab=…` (narration/thinking/choices/…). Those
// triggers render conditionally (thinking mode, enabled features), so they're not guarded as a fixed list.
// Admin Panel → Policies uses the same `subtab=…` slot, and its two are fixed, so they are guarded above.
// Mid-game boot fixtures live in `devFixtures.ts` (`DEV_FIXTURES`); reached via `bootFixture(name)`.
