/** The Overview tab's two managers over the data providers, with the custom prompt panel state the view holds. */
import { useState } from 'react';
import WorldDetailsManager from '@/managers/WorldDetailsManager';
import WorldOverviewManager from '@/managers/WorldOverviewManager';
import { renderPanelBench, withEditorProviders } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';
import type { OverviewPanel } from '@/views/overviewPanels';

// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const OverviewTab = () => {
  const [panel, onPanelChange] = useState<OverviewPanel | null>(null);
  return (
    <>
      <WorldOverviewManager />
      <WorldDetailsManager panel={panel} onPanelChange={onPanelChange} />
    </>
  );
};

/** Both columns: the listing fields, persona rules and music, then the descriptions, readme, prompts and Openings. */
export const renderOverviewTab = (world: World, mode: EditorMode) =>
  renderPanelBench(world, mode, withEditorProviders(<OverviewTab />));
