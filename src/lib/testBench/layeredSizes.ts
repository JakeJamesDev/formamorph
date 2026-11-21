/**
 * The Issues instrument's out-of-band Layered Image size finding: each Variant's decoded pixel size checked
 * against its canvas. Out of band because sizes come from decoding the images, which the synchronous pass
 * can't do. The rules module owns the row this raises ({@link LAYERED_SIZE_MISMATCH}).
 */
import { layeredSizeMismatches, type ImageSize } from '@/lib/layeredImages';
import { mediaEntry } from '@/lib/mediaList';
import type { LayeredMediaEntry, MediaList } from '@/types';
import { finding, layerRef, LAYERED_SIZE_MISMATCH, rigItem, type Finding, type RuleWorld } from './rules';

/** The `data` of every Variant image of every Layered Image, for the caller to decode. */
export function layeredVariantSources(media: MediaList | undefined): string[] {
  return Object.values(media ?? {})
    .filter((e): e is LayeredMediaEntry => e.kind === 'layered')
    .flatMap((rig) => rig.layers.flatMap((l) => l.variants.flatMap((v) => mediaEntry(media, v.mediaId, 'image')?.data ?? [])));
}

const dims = ({ width, height }: ImageSize) => `${width}×${height}`;

/** One finding per Variant whose size differs from its Layered Image's canvas. `sizeOf` reads a decoded size by image data. */
export function checkLayeredSizes(world: RuleWorld, sizeOf: (data: string) => ImageSize | undefined): Finding[] {
  const media = world.worldOverview?.mediaList;
  return Object.values(media ?? {})
    .filter((e): e is LayeredMediaEntry => e.kind === 'layered')
    .flatMap((rig) => layeredSizeMismatches(rig, media, (id) => {
      const data = mediaEntry(media, id, 'image')?.data;
      return data ? sizeOf(data) : undefined;
    }).map((m) => {
      const layer = rig.layers.find((l) => l.id === m.layerId)!;
      return finding(
        LAYERED_SIZE_MISMATCH,
        `${layerRef(rig, layer)}, “${media?.[m.mediaId]?.name || 'Unnamed'}” is ${dims(m.size)}, but the canvas is ${dims(m.canvas)}, so it draws stretched`,
        [rigItem(rig)],
      );
    }));
}
