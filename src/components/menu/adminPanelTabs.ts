/** Tabs on the Admin Panel. Guarded against the dev-router ledger by `devRouter.test.ts`. */
export const ADMIN_PANEL_TABS = ['users', 'broadcasts', 'policies', 'events', 'feedback', 'reports', 'log'] as const;
export type AdminPanelTab = (typeof ADMIN_PANEL_TABS)[number];
