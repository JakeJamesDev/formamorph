import { BookOpen, Braces, ChartColumn, Globe, MapPin, Sparkles, Users, type LucideIcon } from 'lucide-react';

/** The World Editor's tab groups, in rail order. A group with no tab in the current mode draws nothing. */
export const WORLD_EDITOR_TAB_GROUPS = [
  { id: 'world', label: 'World' },
  { id: 'text', label: 'Text' },
  { id: 'logic', label: 'Logic' },
] as const;

export type WorldEditorTabGroupId = (typeof WORLD_EDITOR_TAB_GROUPS)[number]['id'];

export interface WorldEditorTab {
  value: string;
  label: string;
  group: WorldEditorTabGroupId;
  icon: LucideIcon;
  advancedOnly?: boolean;
}

/** The World Editor's top-level tabs, in order. Single source of truth: the rail and the mobile Sections bar
 *  render from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditor`) is guarded against it in
 *  `devRouter.test.ts`. */
export const WORLD_EDITOR_TABS = [
  { value: 'overview', label: 'Overview', group: 'world', icon: Globe },
  { value: 'stats', label: 'Stats', group: 'world', icon: ChartColumn },
  { value: 'entities', label: 'Entities', group: 'world', icon: Users },
  { value: 'locations', label: 'Locations', group: 'world', icon: MapPin },
  { value: 'traits', label: 'Traits', group: 'world', icon: Sparkles },
  { value: 'dictionary', label: 'Dictionary', group: 'text', icon: BookOpen },
  { value: 'placeholders', label: 'Placeholders', group: 'text', icon: Braces, advancedOnly: true },
] as const satisfies readonly WorldEditorTab[];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones. */
export function editorTabsFor(advanced: boolean): WorldEditorTab[] {
  return WORLD_EDITOR_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

export interface WorldEditorTabGroup {
  id: WorldEditorTabGroupId;
  label: string;
  tabs: WorldEditorTab[];
}

/** The groups one editor mode shows, each with its visible tabs. Groups with no visible tab are dropped. */
export function editorTabGroupsFor(advanced: boolean): WorldEditorTabGroup[] {
  const tabs = editorTabsFor(advanced);
  return WORLD_EDITOR_TAB_GROUPS
    .map((g) => ({ id: g.id, label: g.label, tabs: tabs.filter((t) => t.group === g.id) }))
    .filter((g) => g.tabs.length > 0);
}
