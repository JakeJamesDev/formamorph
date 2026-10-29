/** The game side panel's tab values, exported for the dev-router drift guard (`devRouter.test.ts`).
 *  `model` is a mobile-only extra tab and is deliberately not routable. */
export const GAME_LEFT_PANEL_TABS = ['entities', 'notes', 'memory', 'logs'] as const;

/** The right (status) panel's tab values, for the same guard. */
export const GAME_RIGHT_PANEL_TABS = ['stats', 'traits', 'inventory', 'location'] as const;
