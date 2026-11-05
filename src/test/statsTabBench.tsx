/** The Stats tab over its adapter, with the search and panel state the view holds for it. */
import { useState } from 'react';
import { useWorldStatsAdapter } from '@/managers/useWorldStatsAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';

const useStatsTab = ({ search, ...selection }: ListTabSelection) => {
  const [tab, onTabChange] = useState<StatPanelTab>('details');
  return useWorldStatsAdapter({ ...selection, search, navigate: () => {}, tab, onTabChange, focusField: null });
};

export const renderStatsTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useStatsTab);
