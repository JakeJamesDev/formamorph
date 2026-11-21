// Layered Images resolved for one subject: what each Layer shows right now, and the picture type play draws.

import type { Base64Data, GalleryLink, LayeredMediaEntry, LayerVariant, MediaList, TraitRequirementRow } from '@/types';
import { layeredEntry, mediaEntry } from './mediaList';
import type { RowState } from './traitGates';

/** One Layer as play draws it. No `data` = the Layer shows nothing (Q2). */
export interface ResolvedLayer {
  id: string;
  data?: Base64Data;
  /** 0 to 1. */
  opacity: number;
}

/** A Layered Image resolved for one subject, bottom Layer first. */
export interface LayeredPicture {
  kind: 'layered';
  entryId: string;
  /** The image whose size the stack takes: the bottom Layer's first Variant, shown or not (Q3, Q23). */
  canvas: Base64Data;
  layers: ResolvedLayer[];
}

/** A picture play shows: one image's data, or a resolved stack. */
export type Picture = Base64Data | LayeredPicture;

export const isLayeredPicture = (picture: Picture | null | undefined): picture is LayeredPicture =>
  typeof picture === 'object' && picture !== null;

/** What resolving reads for its subject. */
export interface LayerReads {
  /** Each row's state of a Variant's rule, read for the subject showing the picture (Q7). */
  statesOf: (rows: TraitRequirementRow[]) => RowState[];
}

/** The Variant's image data, or undefined when its id names no image entry. */
const variantData = (variant: LayerVariant, media: MediaList | undefined): Base64Data | undefined =>
  mediaEntry(media, variant.mediaId, 'image')?.data;

const holds = (variant: LayerVariant, reads: LayerReads): boolean =>
  !variant.requires?.length || reads.statesOf(variant.requires).some((row) => row.holds);

const clampOpacity = (opacity: number | undefined): number =>
  (typeof opacity === 'number' && Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1);

/** The image that sizes `entry`: its bottom Layer's first Variant (Q23). Undefined = it can draw nothing. */
export const layeredCanvas = (entry: LayeredMediaEntry, media: MediaList | undefined): Base64Data | undefined => {
  const first = entry.layers[0]?.variants[0];
  return first && variantData(first, media);
};

/** The Layered Image a gallery link names, when it has a canvas to draw on. */
export function drawableLayered(link: GalleryLink, media: MediaList | undefined): LayeredMediaEntry | undefined {
  const entry = 'mediaId' in link ? layeredEntry(media, link.mediaId) : undefined;
  return entry && layeredCanvas(entry, media) ? entry : undefined;
}

/**
 * The stack `entry` shows for one subject: per Layer, the first Variant whose rule is empty or holds, else
 * nothing. A Variant naming no image entry is passed over. Undefined when nothing sets the canvas.
 */
export function resolveLayered(entry: LayeredMediaEntry, media: MediaList | undefined, reads: LayerReads): LayeredPicture | undefined {
  const canvas = layeredCanvas(entry, media);
  if (!canvas) return undefined;
  const layers = entry.layers.map((layer): ResolvedLayer => {
    const shown = layer.variants.find((variant) => variantData(variant, media) && holds(variant, reads));
    const data = shown && variantData(shown, media);
    return { id: layer.id, opacity: clampOpacity(layer.opacity), ...(data ? { data } : {}) };
  });
  return { kind: 'layered', entryId: entry.id, canvas, layers };
}

/** Which picture this is, apart from its state: a stack keeps its key while its Layers change. */
export const pictureKey = (picture: Picture): string => (isLayeredPicture(picture) ? `layered:${picture.entryId}` : picture);
