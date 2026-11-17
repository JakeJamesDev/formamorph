import { useCallback } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { editGallery, galleryView } from './mediaGallery';
import type { GalleryImage, GalleryLink } from '@/types';

/**
 * A world gallery as the image widget edits it: its pictures resolved through the world's Media List, and a
 * write that relinks them, placing a new picture into the list in the same step. `write` stores the links.
 */
export function useLinkedGallery(links: GalleryLink[], write: (links: GalleryLink[]) => void, subject: string | undefined) {
  const { worldOverview, addMedia } = useGameData();
  const list = worldOverview.mediaList;
  const { images } = galleryView(links, list);
  const onImagesChange = useCallback((next: GalleryImage[]) => {
    const edited = editGallery(links, list, next, subject);
    // The record's write first, so the History Step is the record's.
    write(edited.links);
    if (Object.keys(edited.added).length) addMedia(edited.added);
  }, [links, list, subject, write, addMedia]);
  return { images, onImagesChange };
}
