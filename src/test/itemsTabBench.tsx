/** The Items tab over its adapter, with the panel state the view holds for it. */
import { useState } from 'react';
import { useWorldItemsAdapter } from '@/managers/useWorldItemsAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { ItemPanelTab } from '@/views/itemPanelTabs';

const useItemsTab = (selection: ListTabSelection) => {
  const [tab, onTabChange] = useState<ItemPanelTab>('profile');
  const [placeholderId, onPlaceholderIdChange] = useState<string | null>(null);
  return useWorldItemsAdapter({ ...selection, tab, onTabChange, placeholderId, onPlaceholderIdChange, onOpenWorldPlaceholder: () => {} });
};

export const renderItemsTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useItemsTab);
