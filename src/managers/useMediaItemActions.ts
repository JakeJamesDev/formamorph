import { useCallback } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useWorldHistoryMovesOptional } from '@/contexts/worldRecorder';
import { entityImages } from '@/lib/entityImages';
import { locationImages } from '@/lib/locationImages';
import { mapImages, withMapImages } from '@/lib/mapBackground';
import { namedBySlot, type MediaItem } from '@/lib/mediaIndex';
import type { GalleryImage, MediaAsset } from '@/types';

/** A field's new value: the replacing file, or null to clear it. */
type Write = MediaAsset | null;

/** A replaced gallery image keeps its place and its rule; a removed one leaves with its rule. */
const writeGallery = (images: readonly GalleryImage[], at: number, next: Write): GalleryImage[] =>
  images.flatMap((img, i) => (i !== at ? [img] : next ? [{ ...img, data: next.data }] : []));

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

  const write = useCallback((item: MediaItem, next: Write) => {
    const { parent, key } = item;
    switch (parent.kind) {
      case 'world':
        if (key === 'thumbnail') updateWorldOverview({ thumbnail: next?.data ?? '' });
        else if (key === 'bgm') updateWorldOverview({ bgm: next?.data ?? null });
        return;
      case 'map': {
        const at = item.galleryIndex;
        if (at !== undefined) {
          updateWorldOverview({ mapBackground: withMapImages(worldOverview.mapBackground, writeGallery(mapImages(worldOverview), at, next)) });
        }
        return;
      }
      case 'entity': {
        if (key === 'sound' || key === 'model') editEntity(parent.id, (e) => ({ ...e, [key]: next ?? undefined }));
        const at = item.galleryIndex;
        if (at !== undefined) editEntity(parent.id, (e) => ({ ...e, images: writeGallery(entityImages(e), at, next) }));
        return;
      }
      case 'location': {
        const location = locations.find((l) => l.id === parent.id);
        if (!location) return;
        const at = item.galleryIndex;
        if (at !== undefined) updateLocation({ ...location, images: writeGallery(locationImages(location), at, next) });
        else if (key === 'ambientSound') updateLocation({ ...location, ambientSound: next ?? undefined });
        return;
      }
      case 'dictionary': {
        const book = dictionaries.find((d) => d.id === parent.id);
        if (book && key === 'thumbnail') updateDictionary({ ...book, thumbnail: next?.data ?? '' });
      }
    }
  }, [editEntity, locations, updateLocation, dictionaries, updateDictionary, worldOverview, updateWorldOverview]);

  const step = useMediaStep();

  const replace = useCallback((item: MediaItem, media: MediaAsset) =>
    step(mediaStepLabel(item.blank ? 'Add' : 'Replace', item), () => write(item, media)), [step, write]);
  const remove = useCallback((item: MediaItem) =>
    step(mediaStepLabel('Remove', item), () => write(item, null)), [step, write]);
  return { replace, remove };
}
