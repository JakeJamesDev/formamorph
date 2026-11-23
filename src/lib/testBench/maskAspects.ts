/**
 * The Issues instrument's out-of-band Weather Mask shape finding: a Mask's decoded aspect ratio checked against
 * each location picture that links it. Out of band because sizes come from decoding the images. The rules
 * module owns the row this raises ({@link MASK_ASPECT_MISMATCH}).
 */
import { layeredCanvas, type ImageSize } from '@/lib/layeredImages';
import { galleryLink } from '@/lib/entityImages';
import { maskEntry } from '@/lib/weatherMask';
import { layeredEntry, mediaEntry } from '@/lib/mediaList';
import type { GalleryLink, GameLocation, MediaList } from '@/types';
import { finding, MASK_ASPECT_MISMATCH, type Finding, type RuleWorld } from './rules';

/** Relative difference between width/height ratios above which a mask counts as the wrong shape. */
export const MASK_ASPECT_TOLERANCE = 0.02;

/** The data of the picture a slot draws: its image, or a Layered Image's canvas. Undefined when it has none. */
function pictureData(link: GalleryLink, media: MediaList | undefined): string | undefined {
  if ('layered' in link) return link.layered.layers.find((layer) => layer.variants.length)?.variants[0].data;
  if ('mediaId' in link) {
    const rig = layeredEntry(media, link.mediaId);
    return rig ? layeredCanvas(rig, media) : mediaEntry(media, link.mediaId, 'image')?.data;
  }
  return link.data;
}

type Pair = { location: GameLocation; slot: number; maskName: string; mask: string; picture: string };

/** Every slot that links an existing Mask and draws a picture. A link to a missing Mask is no mask. */
function pairsOf(world: RuleWorld): Pair[] {
  const media = world.worldOverview?.mediaList;
  return (world.locations ?? []).flatMap((location) => (location.images ?? []).flatMap((raw, slot): Pair[] => {
    const link = galleryLink(raw);
    const mask = maskEntry(media, link?.weatherMask);
    const picture = link && pictureData(link, media);
    return link?.weatherMask && mask && picture ? [{ location, slot, maskName: mask.name, mask: mask.data, picture }] : [];
  }));
}

/** The `data` of every Mask and picture a checked slot holds, for the caller to decode. */
export const maskAspectSources = (world: RuleWorld): string[] => pairsOf(world).flatMap((p) => [p.mask, p.picture]);

const dims = ({ width, height }: ImageSize) => `${width}×${height}`;

/** One finding per slot whose Mask shape differs from its picture. `sizeOf` reads a decoded size by image data. */
export function checkMaskAspects(world: RuleWorld, sizeOf: (data: string) => ImageSize | undefined): Finding[] {
  return pairsOf(world).flatMap(({ location, slot, maskName, mask, picture }) => {
    const m = sizeOf(mask);
    const p = sizeOf(picture);
    if (!m || !p || !m.width || !m.height || !p.width || !p.height) return [];
    const ratio = m.width / m.height / (p.width / p.height);
    if (Math.abs(ratio - 1) <= MASK_ASPECT_TOLERANCE) return [];
    const where = location.name || 'Unnamed';
    return [finding(
      MASK_ASPECT_MISMATCH,
      `“${where}”, image ${slot + 1}: the Weather Mask “${maskName || 'Unnamed'}” is ${dims(m)}, but the picture is ${dims(p)}, so the mask stretches`,
      [{ id: location.id, name: where, section: 'locations' }],
    )];
  });
}
