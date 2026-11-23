import { useCallback } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { composedPictures, editGallery, galleryView, type GalleryMedia } from './mediaGallery';
import { OUTSIDE_PLAY, type LayerReads } from './layeredImages';
import type { GalleryImage, GalleryLink } from '@/types';

/**
 * A world gallery as the image widget edits it: its pictures resolved through the world's Media List, and a
 * write that relinks them, placing a new picture into the list in the same step. `write` stores the links.
 * `reads` is what its Layered Images read.
 */
export function useLinkedGallery(links: GalleryLink[], write: (links: GalleryLink[]) => void, subject: string | undefined, { layered = false, reads = OUTSIDE_PLAY }: { layered?: boolean; reads?: LayerReads } = {}) {
  const { worldOverview, addMedia } = useGameData();
  const list = worldOverview.mediaList;
  const view = galleryView(links, list);
  const { images } = view;
  // A world without a list keeps its pictures embedded, and its slots stay plain uploaders (Q26).
  const media: GalleryMedia | undefined = list ? { list, links: view.links, ...(layered ? { layered: true as const } : {}) } : undefined;
  const onImagesChange = useCallback((next: GalleryImage[]) => {
    const edited = editGallery(links, list, next, subject);
    // The record's write first, so the History Step is the record's.
    write(edited.links);
    if (Object.keys(edited.added).length) addMedia(edited.added);
  }, [links, list, subject, write, addMedia]);
  return { images, onImagesChange, media, pictures: composedPictures(view.links, list, reads) };
}
