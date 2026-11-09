/** The Overview tab's two managers over the data providers, with the right-column place the view holds. */
import { useState } from 'react';
import WorldDetailsManager from '@/managers/WorldDetailsManager';
import WorldOverviewManager from '@/managers/WorldOverviewManager';
import { renderPanelBench, withEditorProviders } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import { DEFAULT_OVERVIEW_PLACE, overviewPanelTabsFor, type OverviewPlace } from '@/views/overviewPanelTabs';

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const OverviewTab = ({ advanced }: { advanced: boolean }) => {
  const [place, onPlaceChange] = useState<OverviewPlace>(DEFAULT_OVERVIEW_PLACE);
  return (
    <>
      <WorldOverviewManager />
      <WorldDetailsManager place={place} onPlaceChange={onPlaceChange} tabs={overviewPanelTabsFor(advanced)} />
    </>
  );
};

/** Both columns: the listing fields, persona rules and music, then the right column's tabs. */
export const renderOverviewTab = (world: World, mode: EditorMode) =>
  renderPanelBench(world, mode, withEditorProviders(<OverviewTab advanced={mode === 'advanced'} />));
