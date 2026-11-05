/** The World Editor's Tools tab over its adapter, with the world snapshot the view builds for it. */
import { useCallback } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { openingStateOf } from '@/lib/openingState';
import { buildToolSnapshot } from '@/lib/tools/toolSnapshot';
import { useWorldToolsAdapter } from '@/managers/useWorldToolsAdapter';
import { renderListTab, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';

const useToolsTab = ({ selectedId, onSelect }: ListTabSelection) => {
  const { getWorldData } = useGameData();
  const snapshot = useCallback(() => {
    const world = getWorldData();
    return buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? [], null, { state: openingStateOf(world), authored: world });
  }, [getWorldData]);
  return { adapter: useWorldToolsAdapter({ selectedId, onSelect, snapshot }) };
};

export const renderToolsListTab = (world: World, mode: EditorMode) => renderListTab(world, mode, useToolsTab);
