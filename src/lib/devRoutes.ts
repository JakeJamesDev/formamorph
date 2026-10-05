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

/** Dev-only routes for panes whose real host needs a server, an admin session, or a deep click path.
 *  `customCode` opens MainMenu's Custom Code Execution dialog on canned stat code when the selected world has none; the
 *  rest mount one pane on canned props (`DevPaneRoutes`). The podium and the sent list still load from the
 *  server, so they show their empty state without one. Players never navigate to these. */
export const DEV_PANE_MODALS = ['customCode', 'eventForm', 'podium', 'sentMessages', 'feedbackForm', 'feedbackEdit', 'changelogEntry', 'fontTune', 'revealDemo', 'presetImport', 'generateImage', 'placeholderPicker'] as const;
export type DevPaneModal = (typeof DEV_PANE_MODALS)[number];

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
 *  `auth` raises the login/register dialog, behind the age gate's check. `designSystem` opens the live reference
 *  showcase without mounting it in production. `enterWorld` starts normal entry for the stored world
 *  named by `tab` (or the first installed world).
 *  `deleteAccount` opens the account-deletion flow at its first step, and `deletionCancelled` the notice
 *  a sign-in raises when it calls a pending deletion off. Neither is reachable by clicking without an
 *  account in the matching state — one needs a real password, the other a request already standing.
 *  `updateRequired` raises the Update Dialog on a canned refusal, since the real one needs a server route
 *  whose minimum version is above the running build. `exitApp` raises the Android exit prompt, which on a
 *  phone only the hardware back button reaches. `connectReferences` raises the Connect World References step
 *  on canned rows (`devConnectReferencesSample.ts`), because in the app it opens only partway through an add
 *  in the World Editor, and only for a library item expecting something that world lacks. `manageAddons`
 *  opens Community Creations and raises the add-on review over the first world listing, the same trick
 *  `likers` uses: the dialog reads a real listing's offers, so it has nothing to show without one.
 *  `componentUpdates` raises the component update review on a canned source and two canned worlds
 *  (`devComponentUpdateSample.ts`), because in the app it opens only for a library item whose revision two
 *  installed worlds are actually behind. Its worlds are held in memory, so Apply Updates writes nothing.
 *  `worldUpdate` raises the world update review on canned rows (`devWorldUpdateSample.ts`), because in the
 *  app it opens only between "update an existing copy" and the write, for a republished world whose
 *  required set has actually moved. Apply closes it and writes nothing.
 *  `importComponent` raises the component-file import review on a canned file
 *  (`devImportComponentSample.ts`), because in the app it opens only for a chosen file that names worlds.
 *  Importing from it does write: the character lands in the library, and a world you tick gets a copy.
 *  `replaceSource` opens the World Editor and raises the Bench's Replace From Library picker over a canned
 *  missing copy, because in the app it opens only from an Issues row whose source is gone. Replace
 *  closes it and writes nothing. `demoAI` is in-game (GameViewer) and opens the Demo AI dialog whatever the
  narration endpoint and the seen-key say, so it is reachable on a build that overrides the default endpoint.
 *  `persona` is in-game (GameViewer) and opens the right panel's Change Persona picker. On mobile that panel
 *  mounts only on the Status tab, so open that tab first. `likePrompt` is in-game (GameViewer) and shows the
 *  once-only like card on a canned listing, because a dev world was never downloaded from one and the card's
 *  answer comes from the server. Its Like press reaches the real route and fails there, which is the point
 *  at which a live listing is needed. `errorDetails` raises a canned ComfyUI rejection toast
 *  (`devErrorDetailsSample.ts`) from any view with toasts; its View Details link opens the dialog.
 *  `formaquestion` opens the help window over whatever is on screen. It is not a dialog, so it does not
 *  close one: open the dialog first, then the window, to see both. `formaquestionSettings` opens the window
 *  and Formaquestion Settings under it. `formaquestionCompare` adds the compare view over them, on a canned
 *  edit of the answer prompt. `formaquestionAiContext` opens the window and its AI Context under it, on two
 *  canned questions with traces, so the popup has pages to show without an AI. `settingsCompare` opens Settings
 *  and the compare view over it, on a canned edit of the Narration prompt. `DEV_PANE_MODALS` follow. */
export const DEV_MODALS = ['settings', 'entity', 'export', 'menu', 'worldEditor', 'intro', 'avatar', 'backup', 'aiSetup', 'entityEditor', 'dictionaryEditor', 'modelDetails', 'community', 'memoryManager', 'profile', 'auth', 'feedbackHub', 'adminPanel', 'editText', 'location', 'changelog', 'eventAck', 'publish', 'worldPrompts', 'aiContext', 'ageGate', 'likers', 'privacyPolicy', 'deleteAccount', 'deletionCancelled', 'updateRequired', 'exitApp', 'designSystem', 'enterWorld', 'connectReferences', 'manageAddons', 'componentUpdates', 'worldUpdate', 'importComponent', 'replaceSource', 'demoAI', 'persona', 'likePrompt', 'errorDetails', 'formaquestion', 'formaquestionSettings', 'formaquestionCompare', 'formaquestionAiContext', 'settingsCompare', ...DEV_PANE_MODALS] as const;
export type DevModal = (typeof DEV_MODALS)[number];

/** The `attach=…` value that stages sample attachments on the game view. */
export const DEV_ATTACH_SAMPLE = 'sample';

/** Coverage ledger: tabbed surface → the sub-tabs the router can target (via `tab=…`). Kept in lockstep
 *  with each surface's own exported tab list by `devRouter.test.ts`. Add a surface's tabs here when wired. */
export const DEV_MODAL_TABS = {
  // The Context Menu reference exposes both production group dialogs with isolated data.
  designSystemGroupPicker: ['picker', 'create'],
  settings: ['display', 'output', 'prompts', 'tools', 'endpoints', 'data'],
  // Settings → Tools opens a New Tool draft on its edit tab with `subtab=…`
  // (`#dev?modal=settings&tab=tools&subtab=handler`). The Tools tab is Advanced only.
  settingsToolEdit: ['definition', 'parameters', 'handler'],
  // Settings → Endpoints opens its own tab with the same `subtab=…` (`#dev?modal=settings&tab=endpoints&subtab=image`).
  // `tagPrompt` is Advanced only and hidden while image generation is off.
  settingsEndpoints: ['text', 'image', 'tagPrompt'],
  worldEditor: ['overview', 'stats', 'entities', 'locations', 'traits', 'dictionary', 'placeholders'],
  // Community Creations browses one kind per tab, plus Contest — a view over the worlds already in the
  // catalog rather than a fourth kind (see lib/browseTabs). `tab=contest` serves canned contests, so the
  // tab is reachable whether or not one is really running.
  community: ['world', 'entity', 'dictionary', 'model', 'prompt', 'contest'],
  // The publish dialog's canned payload: a world by default, or a prompt with `tab=prompt`.
  publish: ['world', 'prompt'],
  // The account dialog: admin messages, the follow feed, the terms, and the account settings. Log Out is a
  // header button rather than a tab, so it is not routable.
  profile: ['messages', 'notifications', 'terms', 'settings'],
  // The reader's side of feedback, behind the main menu's Feedback button; one tab per branch.
  feedbackHub: ['bugs', 'suggestions'],
  // The admin tools: accounts, broadcasts, the publish policies, the events calendar, the feedback
  // queues, the report queue, and the log. `tab=events` serves a canned calendar (`devEventSample.ts`),
  // so the tab's three groups are reachable without a live server; which of its two role views appears
  // follows the session. `tab=reports` needs a live server with the feature — it opens empty otherwise.
  // `tab=serverSettings` is the Server tab: one box per server setting, read from the live server, so
  // against a server without the settings routes each row reports that it went unanswered.
  adminPanel: ['users', 'broadcasts', 'policies', 'serverSettings', 'events', 'feedback', 'reports', 'log'],
  // Admin Panel → Events uses the `subtab=…` slot for which of its two role views to render over the
  // canned calendar, so the moderator's read-only half is reachable without a second account.
  adminPanelEvents: ['admin', 'staff'],
  // The World Editor's Locations tab shows one of two views of the same locations, switched with `subtab=…`
  // (`#dev?modal=worldEditor&tab=locations&subtab=canvas`). Adding `fullscreen=1` opens the canvas in its
  // full-screen window on arrival — the same canvas, so it is not a third view and not listed as one.
  worldEditorLocations: ['list', 'canvas'],
  // The World Editor's entity panel splits its fields across its own tabs, reached with the same `subtab=…`
  // slot over the Entities tab (`#dev?modal=worldEditor&tab=entities&subtab=descriptions`). It lands on the
  // panel, so pair it with a world that has an entity to select. `openings` and `placeholders` are Advanced only.
  worldEditorEntity: ['profile', 'descriptions', 'traits', 'placeholders', 'openings'],
  // The library entity editor (`#dev?modal=entityEditor&tab=placeholders`). It opens on a blank draft and is
  // never in Simple mode, so every tab is reachable.
  entityEditor: ['entity', 'traits', 'placeholders'],
  dictionaryEditor: ['overview', 'dictionary', 'placeholders'],
  // Its Entity tab's sub-tabs, reached with `subtab=…` (`#dev?modal=entityEditor&tab=entity&subtab=openings`).
  entityEditorEntity: ['profile', 'descriptions', 'openings'],
  // The World Editor's location panel does the same over the Locations tab
  // (`#dev?modal=worldEditor&tab=locations&subtab=presence`). It shares that tab's `subtab=…` slot with the
  // List/Canvas switch above, which is why no value may appear in both lists. `pins` is Advanced only.
  worldEditorLocation: ['details', 'presence', 'media', 'pins', 'openings'],
  // The World Editor's stat panel does the same over the Stats tab
  // (`#dev?modal=worldEditor&tab=stats&subtab=code`). `descriptors` and `code` are Advanced only, and
  // Simple mode leaves one tab and no strip, so land those on an Advanced editor.
  worldEditorStat: ['details', 'descriptors', 'code'],
  // The World Editor's trait panel does the same over the Traits tab
  // (`#dev?modal=worldEditor&tab=traits&subtab=stats`). `pins` is Advanced only.
  worldEditorTrait: ['details', 'availability', 'stats', 'pins'],
  // The World Editor's dictionary entry panel does the same over the Dictionary tab
  // (`#dev?modal=worldEditor&tab=dictionary&subtab=matching`). It lands on the entry panel, so pair it with
  // a book that has an entry to select. `matching` is Advanced only, and Simple mode leaves one tab and no
  // strip, so land it on an Advanced editor.
  worldEditorEntry: ['details', 'matching'],
  // The World Editor's dictionary book panel shares that `subtab=…` slot
  // (`#dev?modal=worldEditor&tab=dictionary&subtab=placeholders`). It lands on the book panel, so pair it
  // with a book to select. `placeholders` is Advanced only.
  worldEditorBook: ['details', 'placeholders'],
  // The World Editor's Test Bench: `bench=…` opens the full panel — at whichever placement is remembered —
  // on the instrument it names (`#dev?modal=worldEditor&bench=issues`). Only built instruments are listed,
  // since an unbuilt tab renders
  // disabled and has nothing to land on, so adding one here is part of building it.
  worldEditorBench: ['issues', 'triggers', 'aiContext', 'opening'],
  // The World Editor's Authoring Tour: `tour=…` opens the editor on a new blank world with the tour at that
  // step, every earlier step already taken with its example (`#dev?modal=worldEditor&tour=location-name`).
  worldEditorTour: [
    'world-name', 'world-ai-description', 'world-thumbnail',
    'add-location', 'location-name', 'location-player-description', 'location-ai-description', 'location-image',
    'location-starting',
    'add-second-location', 'second-location-name', 'location-connection',
    'add-entity', 'entity-name', 'entity-locations', 'entity-pronouns', 'entity-image', 'entity-player-description',
    'entity-ai-description',
    'add-stat', 'stat-name', 'stat-description',
    'add-trait', 'trait-name', 'trait-ai-description', 'trait-stat-change',
    'add-dictionary-entry', 'dictionary-name-keywords', 'dictionary-value',
    'editor-mode', 'play',
  ],
  // Admin Panel → Policies has a second level, one sub-tab per authored popup, reached with `subtab=…`.
  adminPanelPolicies: ['uploadGate', 'tagNotice', 'privacyPolicy'],
  // Admin Panel → Feedback uses the same `subtab=…` slot, one per branch.
  adminPanelFeedback: ['bugs', 'suggestions'],
  // The acknowledge poster renders one of an event's two phases; `tab=…` picks which the canned event is at.
  eventAck: ['start', 'end'],
  // MainMenu's library card-type switcher. Not a modal: reached with `tab=…` and no `modal=…`, i.e.
  // `#dev?view=mainMenu&tab=models`. Listed here so the same drift guard covers it.
  mainMenu: ['worlds', 'entities', 'dictionaries', 'models'],
  // Settings → Prompts opens one prompt with `subtab=…` (`#dev?modal=settings&tab=prompts&subtab=choices`).
  // A prompt whose feature is off is not in the rail, and the panel lands on Narration.
  settingsPrompts: [
    'narration', 'thinking', 'director', 'character', 'discover', 'storyboard', 'choices',
    'statupdates', 'location', 'timepassed', 'timeopening', 'summary', 'milestone', 'diary', 'scenetags',
  ],
  // Settings → Prompts has a THIRD level: which surface of the open prompt is on show, reached with
  // `surface=…` (`#dev?modal=settings&tab=prompts&subtab=narration&surface=anatomy`). `anatomy` is the
  // hub every prompt lands on, not an editor; the panel falls back to it wherever a surface doesn't apply.
  settingsPromptSurfaces: ['system', 'user', 'messages', 'options', 'anatomy'],
  // Settings → Prompts preset-level entries, reached with `subtab=…` in place of a prompt
  // (`#dev?modal=settings&tab=prompts&subtab=overview`). A built-in preset shows none and lands on Narration.
  settingsPromptPreset: ['overview'],
  // GameViewer's side panel (Entities/Notes/Memory/Logs). Also not a modal: `#dev?view=gameViewer&tab=memory`.
  // The mobile-only `model` tab is deliberately not routable.
  gameViewer: ['entities', 'notes', 'memory', 'logs'],
  // The narration panel's layout, reached with `mode=…` on the game view (`#dev?view=gameViewer&mode=chat`).
  // It overrides the Narration Layout setting without saving it.
  gameViewerLayout: ['pages', 'chat'],
  // Attached images on the game view, reached with `attach=…` (`#dev?view=gameViewer&fixture=whiteRoom&attach=sample`).
  // `sample` turns Image Attachments on, then runs sample images through the attach path: two wait in the
  // action box and two ride the latest turn's action.
  gameViewerAttach: [DEV_ATTACH_SAMPLE],
  // The Formaquestion window's parts (`#dev?modal=formaquestion&tab=guide`). `subtab=…` takes a docs
  // section id and opens it in the reader. `mode=wide` or `mode=narrow` picks the layout.
  formaquestion: ['ask', 'search', 'guide'],
  // Formaquestion Settings (`#dev?modal=formaquestionSettings&tab=general`).
  formaquestionSettings: ['general', 'endpoint', 'prompts', 'tools', 'mascot'],
} as const;

// Admin Panel → Policies uses the `subtab=…` slot, and its two are fixed, so they are guarded above.
// Mid-game boot fixtures live in `devFixtures.ts` (`DEV_FIXTURES`); reached via `bootFixture(name)`.
