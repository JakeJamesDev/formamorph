/** Tabs on the Admin Panel. Guarded against the dev-router ledger by `devRouter.test.ts`. */
export const ADMIN_PANEL_TABS = ['users', 'broadcasts', 'policies', 'serverSettings', 'usage', 'events', 'feedback', 'moderation', 'log'] as const;
export type AdminPanelTab = (typeof ADMIN_PANEL_TABS)[number];

/** Tabs only an administrator sees. Speaking to everyone, writing what the site requires, changing what
 *  the server does, and reading what it costs are not moderation. */
export const ADMIN_PANEL_OWNER_TABS: readonly AdminPanelTab[] = ['broadcasts', 'policies', 'serverSettings', 'usage'];

/** One label per tab, so the strip and the narrow-width select cannot drift.
 *  "Server", not "Server Settings": the strip is a fixed grid, and the longer name needs 133px in a
 *  105px cell. The panel's own heading carries the full name. */
export const ADMIN_PANEL_TAB_LABELS: Record<AdminPanelTab, string> = {
  users: 'Users',
  broadcasts: 'Broadcasts',
  policies: 'Policies',
  serverSettings: 'Server',
  usage: 'Usage',
  events: 'Events',
  feedback: 'Feedback',
  moderation: 'Moderation',
  log: 'Log',
};
