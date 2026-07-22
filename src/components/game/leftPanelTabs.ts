/** The game side panel's tab values, exported for the dev-router drift guard (`devRouter.test.ts`).
 *  `model` is a mobile-only extra tab and is deliberately not routable. */
export const GAME_LEFT_PANEL_TABS = ['entities', 'notes', 'memory', 'logs'] as const;
