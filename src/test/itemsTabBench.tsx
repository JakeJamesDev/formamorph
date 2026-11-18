/** The Items tab over its adapter, with the panel state the view holds for it. */
import { useState } from 'react';
import { useTreeCollapseStore } from '@/components/treeCollapse';
import { useWorldItemsAdapter } from '@/managers/useWorldItemsAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { ItemPanelTab } from '@/views/itemPanelTabs';

const useItemsTab = (selection: ListTabSelection) => {
  const [tab, onTabChange] = useState<ItemPanelTab>('profile');
  const [placeholderId, onPlaceholderIdChange] = useState<string | null>(null);
  const collapse = useTreeCollapseStore().stateFor('items');
  return useWorldItemsAdapter({ ...selection, collapse, tab, onTabChange, placeholderId, onPlaceholderIdChange, onOpenWorldPlaceholder: () => {} });
};

export const renderItemsTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useItemsTab);
