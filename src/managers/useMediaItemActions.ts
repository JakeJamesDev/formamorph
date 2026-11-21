import { useCallback, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useWorldHistoryMovesOptional } from '@/contexts/worldRecorder';
import { namedBySlot, type MediaItem } from '@/lib/mediaIndex';
import { mediaParentSpec, writeBackdrop, writeMediaSlot, writeSoundSlot, type MediaEditor, type MediaWrite, type SoundSlotWrite } from '@/lib/mediaParents';
import { withImageRule } from '@/lib/entityImages';
import { labelPlaceholders } from '@/lib/placementLetters';
import { readImageAspect } from '@/lib/imageAspect';
import { useMountedRef } from '@/lib/useMountedRef';
import { galleryLinkData } from '@/lib/mediaList';
import { storedCover } from '@/lib/mediaImages';
import { withBackdropImage, withOutline } from '@/lib/bodyLayout';
import type { GalleryLink, MediaAsset, TraitRequirementRow } from '@/types';

/** "Remove Ambient Sound: Lamp Room", or "Replace Background Music" for world media. */
export const mediaStepLabel = (verb: string, item: MediaItem): string =>
  namedBySlot(item) ? `${verb} ${item.slot}` : `${verb} ${item.slot}: ${item.parent.name}`;

/** Whether a panel offers Replace and Remove. Avatars act from their own panel. */
export const actsInItemPanel = (item: MediaItem): boolean => item.kind !== 'avatar' && item.kind !== 'layered';

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
  const { editEntity, locations, updateLocation, dictionaries, updateDictionary, items, updateItem, worldOverview, updateWorldOverview, addMedia, bodies, setBodies, entities, placeholders } = useGameData();

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
    body: (id, edit) => setBodies(bodies.map((b) => (b.id === id ? edit(b) : b))),
    item: (id, edit) => {
      const item = items.find((i) => i.id === id);
      if (item) updateItem(edit(item));
    },
    read: { entity: (id) => entities.find((e) => e.id === id), location: (id) => locations.find((l) => l.id === id), body: (id) => bodies.find((b) => b.id === id), item: (id) => items.find((i) => i.id === id), overview: () => worldOverview, mediaList: () => worldOverview.mediaList, subject: (name) => labelPlaceholders(name, placeholders) },
    addMedia,
  }), [editEntity, locations, updateLocation, dictionaries, updateDictionary, items, updateItem, worldOverview, updateWorldOverview, bodies, setBodies, entities, addMedia, placeholders]);

  const step = useMediaStep();
  const mounted = useMountedRef();

  const run = useCallback((verb: string, item: MediaItem, next: MediaWrite, write?: () => void) => {
    const label = mediaParentSpec(item.parent.kind).stepLabel?.(item, worldOverview, next) ?? mediaStepLabel(verb, item);
    return step(label, write ?? (() => writeMediaSlot(editor, item, next)));
  }, [editor, step, worldOverview]);

  const replace = useCallback(async (item: MediaItem, media: MediaAsset) => {
    const verb = item.blank ? 'Add' : 'Replace';
    if (item.parent.kind !== 'body') return run(verb, item, media);
    // A Custom Image sets the Backdrop's aspect (Q15), in the same step as the file.
    const aspect = await readImageAspect(media.data, null);
    if (!mounted.current) return;
    return run(verb, item, media, () => writeBackdrop(editor, item.parent, media, aspect ?? undefined));
  }, [run, editor, mounted]);
  const remove = useCallback((item: MediaItem) => run('Remove', item, null), [run]);
  /** A sound slot's write: a link it placed, a file in a world with no list, or none. */
  const writeSound = useCallback((item: MediaItem, next: SoundSlotWrite) =>
    step(mediaStepLabel(next ? 'Replace' : 'Remove', item), () => writeSoundSlot(editor, item, next)), [editor, step]);
  /** A picker slot's write for the world cover or a Body's Custom Image: the link it placed, or null to clear it. */
  const writeImageLink = useCallback(async (item: MediaItem, link: GalleryLink | null, placed?: string) => {
    const label = mediaStepLabel(link ? (item.blank ? 'Add' : 'Replace') : 'Remove', item);
    if (item.parent.kind !== 'body') return step(label, () => editor.overview(() => ({ thumbnail: storedCover(link) })));
    const data = link ? placed ?? galleryLinkData(link, worldOverview.mediaList) : undefined;
    // A Custom Image sets the Backdrop's aspect (Q15), in the same step as the link.
    const aspect = data ? await readImageAspect(data, null) : null;
    if (!mounted.current) return;
    const id = item.parent.id;
    return step(label, () => editor.body(id, (b) => (link && data ? withBackdropImage(b, link, aspect ?? undefined) : withOutline(b, 'humanoid'))));
  }, [editor, step, worldOverview.mediaList, mounted]);
  /** Sets a gallery image's Visibility rule rows, an ordinary edit with no step of its own. */
  const setRules = useCallback((item: MediaItem, rows: TraitRequirementRow[]) => {
    const at = item.galleryIndex;
    if (at !== undefined) mediaParentSpec(item.parent.kind).gallery?.write(editor, item.parent, (images) => withImageRule(images, at, rows));
  }, [editor]);
  return { replace, remove, setRules, writeSound, writeImageLink };
}
