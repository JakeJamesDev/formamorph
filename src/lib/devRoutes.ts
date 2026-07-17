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

/** Modals the router can open via `#dev?modal=…`. `settings` opens from MainMenu or GameViewer; `menu` and
 *  `worldEditor` open from MainMenu; `entity`/`export` are in-game (GameViewer). `worldEditor` is an in-place
 *  modal on MainMenu (not a top-level view). `intro` replays the first-run welcome overlay on MainMenu.
 *  `localModel` is intentionally absent — it lives inside
 *  Settings→LocalModelPanel, reached via `modal=settings` + its tab, not its own name. `avatar` opens
 *  MainMenu's Character Customization step directly (a MainMenu sub-state, like `worldEditor`).
 *  `aiSetup` opens the AI setup gate on MainMenu in its skippable (first-run) form. `entityEditor` and
 *  `dictionaryEditor` are the *library* editors (MainMenu), distinct from the in-game `entity` modal; both
 *  open on a blank draft, so they're reachable without any stored data. */
export const DEV_MODALS = ['settings', 'entity', 'export', 'menu', 'worldEditor', 'intro', 'avatar', 'backup', 'aiSetup', 'entityEditor', 'dictionaryEditor'] as const;
export type DevModal = (typeof DEV_MODALS)[number];

/** Coverage ledger: tabbed surface → the sub-tabs the router can target (via `tab=…`). Kept in lockstep
 *  with each surface's own exported tab list by `devRouter.test.ts`. Add a surface's tabs here when wired. */
export const DEV_MODAL_TABS = {
  settings: ['presentation', 'generation', 'endpoint', 'image', 'prompts', 'accessibility'],
  worldEditor: ['overview', 'stats', 'entities', 'locations', 'traits', 'dictionary', 'placeholders'],
} as const;

// Settings → Prompts exposes a second level reached via `subtab=…` (narration/thinking/choices/…). Those
// triggers render conditionally (thinking mode, enabled features), so they're not guarded as a fixed list.
// Mid-game boot fixtures live in `devFixtures.ts` (`DEV_FIXTURES`); reached via `bootFixture(name)`.
