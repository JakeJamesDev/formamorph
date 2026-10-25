import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useWorldHistoryMovesOptional } from '@/contexts/worldRecorder';
import { namedBySlot, type MediaItem } from '@/lib/mediaIndex';
import { mediaParentSpec, writeMediaSlot, type MediaEditor, type MediaWrite } from '@/lib/mediaParents';
import { withImageRule } from '@/lib/entityImages';
import type { MediaAsset, TraitRequirementRow } from '@/types';

/** "Remove Ambient Sound: Lamp Room", or "Replace Background Music" for world media. */
export const mediaStepLabel = (verb: string, item: MediaItem): string =>
  namedBySlot(item) ? `${verb} ${item.slot}` : `${verb} ${item.slot}: ${item.parent.name}`;

/** Whether a panel offers Replace and Remove. Avatars act from their own panel. */
export const actsInItemPanel = (item: MediaItem): boolean => item.kind !== 'avatar';

/** Runs a write as one labeled History Step that keeps the Media tab as its Origin. */
export function useMediaStep() {
  const history = useWorldHistoryMovesOptional();
  return useCallback(async (label: string, run: () => void) => {
    if (!history) { run(); return; }
    // A group, not a batch: a batch drops the Origin that brings an undo back to this tab.
    history.beginGroup(label);
    try {
      run();
    } finally {
      await history.endGroup();
    }
  }, [history]);
}

/**
 * Replace and Remove for every slot but an Avatar's. Each writes the field the slot's own panel writes,
 * cleared the way that panel clears it, as one History Step that keeps the Media tab as its Origin.
 */
export function useMediaItemActions() {
  const { editEntity, locations, updateLocation, dictionaries, updateDictionary, worldOverview, updateWorldOverview } = useGameData();

  const editor = useMemo<MediaEditor>(() => ({
    overview: (patch) => updateWorldOverview(patch(worldOverview)),
    entity: editEntity,
    location: (id, edit) => {
      const location = locations.find((l) => l.id === id);
      if (location) updateLocation(edit(location));
    },
    dictionary: (id, edit) => {
      const book = dictionaries.find((d) => d.id === id);
      if (book) updateDictionary(edit(book));
    },
  }), [editEntity, locations, updateLocation, dictionaries, updateDictionary, worldOverview, updateWorldOverview]);

  const step = useMediaStep();

  const run = useCallback((verb: string, item: MediaItem, next: MediaWrite) => {
    const label = mediaParentSpec(item.parent.kind).stepLabel?.(item, worldOverview, next) ?? mediaStepLabel(verb, item);
    return step(label, () => writeMediaSlot(editor, item, next));
  }, [editor, step, worldOverview]);

  const replace = useCallback((item: MediaItem, media: MediaAsset) => run(item.blank ? 'Add' : 'Replace', item, media), [run]);
  const remove = useCallback((item: MediaItem) => run('Remove', item, null), [run]);
  /** Sets a gallery image's Visibility rule rows, an ordinary edit with no step of its own. */
  const setRules = useCallback((item: MediaItem, rows: TraitRequirementRow[]) => {
    const at = item.galleryIndex;
    if (at !== undefined) mediaParentSpec(item.parent.kind).gallery?.write(editor, item.parent, (images) => withImageRule(images, at, rows));
  }, [editor]);
  return { replace, remove, setRules };
}
