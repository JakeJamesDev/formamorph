/** The Media tab over its List Editor parts, with the host state the view holds for it. */
import { act } from '@testing-library/react';
import { useWorldMediaEditor } from '@/managers/useWorldMediaEditor';
import { renderListParts, type ListTabSelection } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { World } from '@/types';

// Go to and the Publish Size measure belong to the view, so this host leaves them idle.
const useMediaTab = ({ selectedId, onSelect, search }: ListTabSelection) => ({
  parts: useWorldMediaEditor({
    selectedId, onSelect, search, onGoTo: () => {}, publishBytes: null, optimize: { progress: null, onRun: () => {} },
  }),
});

let latest: ReturnType<typeof renderListParts> | undefined;

export const renderMediaTab = (world: World, mode: EditorMode) => {
  latest = renderListParts(world, mode, useMediaTab);
  return latest;
};

/** One step back through the history's moves, as the undo chord takes it. */
export const undoMediaEdit = () => act(async () => { latest!.history().undo(); });
