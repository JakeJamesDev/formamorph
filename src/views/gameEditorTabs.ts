import { AlignLeft, Eye, EyeOff, LayoutDashboard } from 'lucide-react';

import { ELEMENT_ICONS } from '@/lib/elementIcons';
import type { NavRailGroup, NavRailTab } from '@/components/NavRail';

/** The Game Editor's tab groups, in Sections bar order. A group with no tab draws nothing. Unlike the World
 *  Editor's, a group draws its label as a caption over its tabs. */
export const GAME_EDITOR_TAB_GROUPS = [
  { id: 'entities', label: 'Entities' },
  { id: 'world', label: 'World' },
  { id: 'story', label: 'Story' },
] as const;

type GameEditorTabGroupId = (typeof GAME_EDITOR_TAB_GROUPS)[number]['id'];

export interface GameEditorTab extends NavRailTab {
  /** Left out for a tab that stands alone ahead of the groups. */
  group?: GameEditorTabGroupId;
}

/** The Game Editor's top-level tabs, in order. The rail and the mobile Sections bar render from this. */
export const GAME_EDITOR_TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'entities', label: 'Entities', icon: ELEMENT_ICONS.entities },
  { value: 'active', label: 'Active', icon: Eye, nested: true },
  { value: 'inactive', label: 'Inactive', icon: EyeOff, nested: true },
] as const satisfies readonly GameEditorTab[];

export type GameEditorTabValue = (typeof GAME_EDITOR_TABS)[number]['value'];

/** The tab a route names, or Overview for none or one the editor doesn't have. */
export const gameEditorTab = (value: string | null | undefined): GameEditorTabValue =>
  GAME_EDITOR_TABS.find((t) => t.value === value)?.value ?? 'overview';

/** The landing slot of ungrouped tabs first, then the groups, with an extension's tabs in their group. Slots
 *  with no tab are dropped. */
export function gameEditorTabGroups(extra: readonly GameEditorTab[] = []): NavRailGroup[] {
  const tabs: readonly GameEditorTab[] = [...GAME_EDITOR_TABS, ...extra];
  const landing = { id: 'landing', tabs: tabs.filter((t) => !t.group) };
  const groups = GAME_EDITOR_TAB_GROUPS.map((g) => ({ id: g.id, caption: g.label, tabs: tabs.filter((t) => t.group === g.id) }));
  return [landing, ...groups].filter((g) => g.tabs.length > 0);
}

/** The Game Editor entity panel's tabs, in order. Profile and Descriptions match the World Editor's entity panel. */
export const GAME_ENTITY_PANEL_TABS = [
  { value: 'profile', label: 'Profile', icon: ELEMENT_ICONS.entity },
  { value: 'descriptions', label: 'Descriptions', icon: AlignLeft },
  { value: 'stats', label: 'Stats', icon: ELEMENT_ICONS.stat },
] as const;

export type GameEntityPanelTab = (typeof GAME_ENTITY_PANEL_TABS)[number]['value'];
