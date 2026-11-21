// Layered Images resolved for one subject: what each Layer shows right now, and the picture type play draws.

import type { Base64Data, GalleryLink, LayerBlend, LayeredMediaEntry, LayerSetting, LayerVariant, MediaLayer, MediaList, TraitRequirementRow } from '@/types';
import { DEFAULT_MASCOT_TRANSITION, parseMascotTransition, type MascotTransition } from './formaquestion/mascotTransition';
import { parseHex6 } from './hslColor';
import { layeredEntry, mediaEntry } from './mediaList';
import type { RowState } from './traitGates';

/** One Layer as play draws it. No `data` = the Layer shows nothing (Q2). */
export interface ResolvedLayer {
  id: string;
  data?: Base64Data;
  /** 0 to 1. */
  opacity: number;
  /** `#rrggbb`; absent = no tint. */
  tint?: string;
  blend: LayerBlend;
  transition: MascotTransition;
}

/** A Layer's transition when it stores none: Dissolve at the Mascot's default tuning (Q16). */
export const DEFAULT_LAYER_TRANSITION: MascotTransition = { ...DEFAULT_MASCOT_TRANSITION, mode: 'dissolve' };

/** A Layer's transition as play runs it: the stored one held to the Mascot's ranges, or the default. */
export const layerTransition = (layer: MediaLayer): MascotTransition =>
  (layer.transition === undefined ? DEFAULT_LAYER_TRANSITION : parseMascotTransition(layer.transition, DEFAULT_LAYER_TRANSITION));

/** A Layered Image resolved for one subject, bottom Layer first. */
export interface LayeredPicture {
  kind: 'layered';
  entryId: string;
  /** The image whose size the stack takes: the lowest Layer's first Variant, shown or not (Q3, Q23). */
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

/** An opacity as play draws it: 0 to 1, and 1 when absent or not a number. */
export const clampOpacity = (opacity: number | undefined): number =>
  (typeof opacity === 'number' && Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1);

/** A stored tint as `#rrggbb`, or undefined for none: white tints nothing, and a malformed value is ignored. */
export const normalizeTint = (tint: string | undefined): string | undefined => {
  const hex = parseHex6(tint ?? '');
  return hex && hex !== '#ffffff' ? hex : undefined;
};

/** The Variant that sizes `entry`: the first Variant of its lowest Layer that has one (Q23, Q27). */
export const canvasVariant = (entry: LayeredMediaEntry): LayerVariant | undefined =>
  entry.layers.find((layer) => layer.variants.length)?.variants[0];

/** The image that sizes `entry`, shown or not. Undefined = it can draw nothing. */
export const layeredCanvas = (entry: LayeredMediaEntry, media: MediaList | undefined): Base64Data | undefined => {
  const first = canvasVariant(entry);
  return first && variantData(first, media);
};

/** The Layered Image a gallery link names, when it has a canvas to draw on. */
export function drawableLayered(link: GalleryLink, media: MediaList | undefined): LayeredMediaEntry | undefined {
  const entry = 'mediaId' in link ? layeredEntry(media, link.mediaId) : undefined;
  return entry && layeredCanvas(entry, media) ? entry : undefined;
}

/** The index of the Variant `layer` shows: the first that names an image and whose rule is empty or holds; -1 for none. */
export const shownVariant = (layer: MediaLayer, media: MediaList | undefined, reads: LayerReads): number =>
  layer.variants.findIndex((variant) => variantData(variant, media) && holds(variant, reads));

/** What outside play reads: every rule holds, so each Layer shows its first Variant (Q5). */
export const OUTSIDE_PLAY: LayerReads = { statesOf: (rows) => rows.map(() => ({ holds: true, conditions: [] })) };

/** The Variant `layer` shows for one subject: the one its setting names while the Layer still holds it (Q10, Q33),
 *  else the one its rules show. */
function subjectVariant(layer: MediaLayer, media: MediaList | undefined, reads: LayerReads, setting?: LayerSetting): LayerVariant | undefined {
  const set = setting?.variant === undefined ? undefined
    : layer.variants.find((variant) => variant.mediaId === setting.variant && variantData(variant, media));
  return set ?? layer.variants[shownVariant(layer, media, reads)];
}

/**
 * The stack `entry` shows for one subject, given its settings by Layer id: per Layer, its shown Variant or
 * nothing, and the set opacity and tint over the authored ones. Undefined when nothing sets the canvas.
 */
export function resolveLayered(
  entry: LayeredMediaEntry, media: MediaList | undefined, reads: LayerReads, settings?: Readonly<Record<string, LayerSetting>>,
): LayeredPicture | undefined {
  const canvas = layeredCanvas(entry, media);
  if (!canvas) return undefined;
  const layers = entry.layers.map((layer): ResolvedLayer => {
    const setting = settings?.[layer.id];
    const shown = subjectVariant(layer, media, reads, setting);
    const data = shown && variantData(shown, media);
    const tint = normalizeTint(setting?.tint ?? layer.tint);
    return {
      id: layer.id,
      opacity: clampOpacity(setting?.opacity ?? layer.opacity),
      blend: layer.blend ?? 'normal',
      transition: layerTransition(layer),
      ...(tint ? { tint } : {}), ...(data ? { data } : {}),
    };
  });
  return { kind: 'layered', entryId: entry.id, canvas, layers };
}

/** The stack outside play: each Layer's first Variant that names an image, rules ignored (Q5). */
export function outsidePlayLayered(entry: LayeredMediaEntry, media: MediaList | undefined): LayeredPicture | undefined {
  return resolveLayered(entry, media, OUTSIDE_PLAY);
}

/** A Variant's pixel size, or undefined until it is known. */
export type ImageSize = { width: number; height: number };

/** One Variant whose size differs from the canvas image's. */
export interface SizeMismatch {
  layerId: string;
  mediaId: string;
  size: ImageSize;
  canvas: ImageSize;
}

/**
 * The Variants whose pixel size differs from the canvas image's (Q3). Same aspect at another size still
 * differs. A Variant whose size `sizeOf` does not know yet is passed over, as is every one while the canvas's is unknown.
 */
export function layeredSizeMismatches(
  entry: LayeredMediaEntry, media: MediaList | undefined, sizeOf: (mediaId: string) => ImageSize | undefined,
): SizeMismatch[] {
  const base = canvasVariant(entry);
  const canvas = base && mediaEntry(media, base.mediaId, 'image') && sizeOf(base.mediaId);
  if (!canvas) return [];
  return entry.layers.flatMap((layer) => layer.variants.flatMap((variant): SizeMismatch[] => {
    const size = mediaEntry(media, variant.mediaId, 'image') && sizeOf(variant.mediaId);
    return size && (size.width !== canvas.width || size.height !== canvas.height)
      ? [{ layerId: layer.id, mediaId: variant.mediaId, size, canvas }] : [];
  }));
}

/** Which picture this is, apart from its state: a stack keeps its key while its Layers change. */
export const pictureKey = (picture: Picture): string => (isLayeredPicture(picture) ? `layered:${picture.entryId}` : picture);
