/** The Dictionary tab over its adapter, with the panel state the view holds for it. */
import { useState } from 'react';
import { useWorldDictionaryAdapter } from '@/managers/useWorldDictionaryAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { DictionaryBookPanelTab } from '@/views/dictionaryBookPanelTabs';
import type { DictionaryPanelTab } from '@/views/dictionaryPanelTabs';

const useDictionaryTab = (selection: ListTabSelection) => {
  const [bookTab, onBookTabChange] = useState<DictionaryBookPanelTab>('details');
  const [entryTab, onEntryTabChange] = useState<DictionaryPanelTab>('details');
  const [bookPlaceholderId, onBookPlaceholderIdChange] = useState<string | null>(null);
  return useWorldDictionaryAdapter({
    ...selection, bookTab, onBookTabChange, bookPlaceholderId, onBookPlaceholderIdChange, entryTab, onEntryTabChange,
    onOpenWorldPlaceholder: () => {}, focusField: null, library: { onAddFromLibrary: () => {}, onImport: () => {} }, pendingLinks: [],
  });
};

export const renderDictionaryTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useDictionaryTab);
