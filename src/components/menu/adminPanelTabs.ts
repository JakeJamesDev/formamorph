import {
  CalendarDays, Coins, FileCheck, History, Mail, Megaphone, MessageSquare, Server, ShieldCheck, UserCog, type LucideIcon,
} from 'lucide-react';

/** Tabs on the Admin Panel. Guarded against the dev-router ledger by `devRouter.test.ts`. */
export const ADMIN_PANEL_TABS = ['users', 'feedback', 'moderation', 'usage', 'mail', 'events', 'broadcasts', 'policies', 'serverSettings', 'log'] as const;
export type AdminPanelTab = (typeof ADMIN_PANEL_TABS)[number];

/** Tabs only an administrator sees. Speaking to everyone, writing what the site requires, changing what
 *  the server does, and reading what it costs are not moderation. */
export const ADMIN_PANEL_OWNER_TABS: readonly AdminPanelTab[] = ['broadcasts', 'policies', 'serverSettings', 'usage', 'mail'];

/** One label and icon per tab. "Server", not "Server Settings": the panel's own heading carries the full name. */
export const ADMIN_PANEL_TAB_FACES: Record<AdminPanelTab, { label: string; icon: LucideIcon }> = {
  users: { label: 'Users', icon: UserCog },
  broadcasts: { label: 'Broadcasts', icon: Megaphone },
  policies: { label: 'Policies', icon: FileCheck },
  serverSettings: { label: 'Server', icon: Server },
  usage: { label: 'Usage', icon: Coins },
  mail: { label: 'Mail', icon: Mail },
  events: { label: 'Events', icon: CalendarDays },
  feedback: { label: 'Feedback', icon: MessageSquare },
  moderation: { label: 'Moderation', icon: ShieldCheck },
  log: { label: 'Log', icon: History },
};

/** The Sections bar's groups, in strip order: people, activity, then the site itself. */
const ADMIN_PANEL_TAB_GROUPS: readonly { id: string; tabs: readonly AdminPanelTab[] }[] = [
  { id: 'people', tabs: ['users', 'feedback', 'moderation'] },
  { id: 'activity', tabs: ['usage', 'mail', 'events', 'broadcasts'] },
  { id: 'site', tabs: ['policies', 'serverSettings', 'log'] },
];

/** The groups one role sees. A moderator's drop the administrator's tabs. */
export function adminPanelTabGroupsFor(owner: boolean) {
  return ADMIN_PANEL_TAB_GROUPS.map((group) => ({
    id: group.id,
    tabs: group.tabs
      .filter((value) => owner || !ADMIN_PANEL_OWNER_TABS.includes(value))
      .map((value) => ({ value, ...ADMIN_PANEL_TAB_FACES[value] })),
  }));
}
