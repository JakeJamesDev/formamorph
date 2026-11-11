/** The Traits tab over its adapter, with the panel state the view holds for it. */
import { useState } from 'react';
import { useTreeCollapseStore } from '@/components/treeCollapse';
import { useWorldTraitsAdapter } from '@/managers/useWorldTraitsAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { TraitPanelTab } from '@/views/traitPanelTabs';

const useTraitsTab = ({ selectedId, onSelect }: ListTabSelection) => {
  const [tab, onTabChange] = useState<TraitPanelTab>('details');
  const collapse = useTreeCollapseStore().stateFor('traits');
  return useWorldTraitsAdapter({ selectedId, onSelect, collapse, navigate: () => {}, tab, onTabChange, focusField: null });
};

export const renderTraitsTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useTraitsTab);
