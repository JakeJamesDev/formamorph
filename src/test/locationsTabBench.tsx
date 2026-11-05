/** The Locations tab over its adapter, with the panel state the view holds for it. */
import { useState } from 'react';
import { useWorldLocationsAdapter } from '@/managers/useWorldLocationsAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { LocationPanelTab } from '@/views/locationPanelTabs';
import type { LocationView } from '@/views/locationViews';

const useLocationsTab = (selection: ListTabSelection) => {
  const [tab, onTabChange] = useState<LocationPanelTab>('details');
  const [view] = useState<LocationView>('list');
  return { adapter: useWorldLocationsAdapter({ ...selection, view, tab, onTabChange, focusField: null }) };
};

export const renderLocationsTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useLocationsTab);
