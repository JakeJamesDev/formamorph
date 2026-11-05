/** The Entities tab over its adapter, with the panel state the view holds for it. */
import { useState } from 'react';
import { useWorldEntitiesAdapter } from '@/managers/useWorldEntitiesAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { EntityPanelTab } from '@/views/entityPanelTabs';

const useEntitiesTab = (selection: ListTabSelection) => {
  const [tab, onTabChange] = useState<EntityPanelTab>('profile');
  const [traitId, onTraitIdChange] = useState<string | null>(null);
  const [statId, onStatIdChange] = useState<string | null>(null);
  const [placeholderId, onPlaceholderIdChange] = useState<string | null>(null);
  return useWorldEntitiesAdapter({
    ...selection, tab, onTabChange, traitId, onTraitIdChange, statId, onStatIdChange, placeholderId, onPlaceholderIdChange,
    onOpenWorldPlaceholder: () => {}, focusField: null, library: { onAddFromLibrary: () => {}, onImport: () => {} }, pendingLinks: [],
  });
};

export const renderEntitiesTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useEntitiesTab);
