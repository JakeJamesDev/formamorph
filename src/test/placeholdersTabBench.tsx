/** The Placeholders tab over its adapter, with the panel state the view holds for it. */
import { useState } from 'react';
import { useWorldPlaceholdersAdapter } from '@/managers/useWorldPlaceholdersAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { PlaceholderPanelTab } from '@/views/placeholderPanelTabs';

const usePlaceholdersTab = (selection: ListTabSelection) => {
  const [tab, onTabChange] = useState<PlaceholderPanelTab>('details');
  return useWorldPlaceholdersAdapter({ ...selection, tab, onTabChange, onOpenOwner: () => {} });
};

export const renderPlaceholdersTab = (world: World, mode: EditorMode) => renderListTab(world, mode, usePlaceholdersTab);
