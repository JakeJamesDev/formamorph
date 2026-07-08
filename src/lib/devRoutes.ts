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
export const DEV_VIEWS = ['mainMenu', 'gameViewer', 'worldEditor'] as const;
export type DevView = (typeof DEV_VIEWS)[number];

/** Coverage ledger: modal → the sub-tabs the router can target. Kept in lockstep with each surface's
 *  own exported tab list by `devRouter.test.ts`. Add a modal's tabs here when you wire that section. */
export const DEV_MODAL_TABS = {
  settings: ['presentation', 'generation', 'endpoint', 'image', 'prompts', 'accessibility'],
} as const;

export type DevModal = keyof typeof DEV_MODAL_TABS;

// Mid-game boot fixtures live in `devFixtures.ts` (`DEV_FIXTURES`); the router reaches them via
// `#dev?view=gameViewer&fixture=…` / `window.__fmDev.bootFixture(name)`.
