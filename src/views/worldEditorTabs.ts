import { BookOpen, Braces, ChartColumn, Globe, MapPin, ToggleRight, Users, type LucideIcon } from 'lucide-react';

/** The World Editor's tab groups, in Sections bar order. A group with no tab in the current mode draws nothing. */
export const WORLD_EDITOR_TAB_GROUPS = [
  { id: 'content', label: 'Content' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'logic', label: 'Logic' },
] as const;

export type WorldEditorTabGroupId = (typeof WORLD_EDITOR_TAB_GROUPS)[number]['id'];

export interface WorldEditorTab {
  value: string;
  label: string;
  /** Left out for a tab that stands alone ahead of the groups. */
  group?: WorldEditorTabGroupId;
  icon: LucideIcon;
  advancedOnly?: boolean;
}

/** The World Editor's top-level tabs, in order. Single source of truth: the desktop strip and the mobile Sections bar
 *  render from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditor`) is guarded against it in
 *  `devRouter.test.ts`. */
export const WORLD_EDITOR_TABS = [
  { value: 'overview', label: 'Overview', icon: Globe },
  { value: 'stats', label: 'Stats', group: 'content', icon: ChartColumn },
  { value: 'entities', label: 'Entities', group: 'content', icon: Users },
  { value: 'locations', label: 'Locations', group: 'content', icon: MapPin },
  { value: 'traits', label: 'Traits', group: 'content', icon: ToggleRight },
  { value: 'dictionary', label: 'Dictionary', group: 'vocabulary', icon: BookOpen },
  { value: 'placeholders', label: 'Placeholders', group: 'vocabulary', icon: Braces, advancedOnly: true },
] as const satisfies readonly WorldEditorTab[];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones. */
export function editorTabsFor(advanced: boolean): WorldEditorTab[] {
  return WORLD_EDITOR_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

const LANDING_SLOT_ID = 'landing';

export interface WorldEditorTabGroup {
  id: WorldEditorTabGroupId | typeof LANDING_SLOT_ID;
  /** Absent on the landing slot, which has no group name. */
  label?: string;
  tabs: WorldEditorTab[];
}

/** The slots one editor mode shows, each with its visible tabs: the landing slot of ungrouped tabs first, then
 *  the groups. Slots with no visible tab are dropped. */
export function editorTabGroupsFor(advanced: boolean): WorldEditorTabGroup[] {
  const tabs = editorTabsFor(advanced);
  const landing: WorldEditorTabGroup = { id: LANDING_SLOT_ID, tabs: tabs.filter((t) => !t.group) };
  const groups = WORLD_EDITOR_TAB_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    tabs: tabs.filter((t) => t.group === g.id),
  }));
  return [landing, ...groups].filter((g) => g.tabs.length > 0);
}

/** The desktop list card's width below which the expanded rail would squeeze the widest list toolbar (Locations,
 *  324px with its whole placeholder) under its width. */
export const RAIL_ROOM_PX = 544;
