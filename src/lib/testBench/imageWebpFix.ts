/**
 * The repair behind the `image-not-webp` row. It can't be one of the registry's pure `fix` functions — every
 * image has to be decoded and re-encoded — so it lives beside the rule seam and the Bench hook runs it on
 * demand, the way the stat-code check runs.
 *
 * It re-derives what to convert from the world it is handed, so a run started before an edit converts what
 * that world held, and the caller decides whether that result is still current.
 */
import { entityImages } from '@/lib/entityImages';
import { dataUrlMime, isConvertibleImage, reencodeKeepsAnimation } from '@/lib/imageBytes';
import { describeKeptImages, reencodeImageDataUrl } from '@/lib/imageOptim';
import type { RuleWorld } from './rules';

/** What one run did: the world to write back, plus what it did to the images it touched. */
export interface WebpFixRun {
  world: RuleWorld;
  /** Images that came back as genuinely smaller WebP. */
  converted: number;
  /** Images the encoder handed straight back — its grow-guard keeps anything a WebP copy would enlarge. */
  kept: number;
  /** GIFs left untouched because this browser has no frame decoder, so converting would flatten them. Its
   *  own tally rather than part of `kept`: the reason differs, and so does what the author can do about it. */
  skippedAnimated: number;
}

/**
 * Convert every convertible image in `world` to lossless WebP at its original resolution, returning the new
 * world and the tally. A result that isn't WebP is discarded: the encoder falls back to lossy JPEG where WebP
 * is unavailable, and a lossless repair must never quietly become a lossy one.
 */
export async function convertWorldImagesToWebp(world: RuleWorld): Promise<WebpFixRun> {
  let converted = 0;
  let kept = 0;
  let skippedAnimated = 0;

  const convert = async (url: string): Promise<string> => {
    if (!isConvertibleImage(url)) return url;
    // Every flagged image the run leaves behind is counted, whichever reason left it: the row it belongs to
    // will still be there afterwards, and an author told nothing reads that as a Fix button that is broken.
    if (!reencodeKeepsAnimation(url)) {
      skippedAnimated += 1;
      return url;
    }
    const out = await reencodeImageDataUrl(url);
    if (out !== url && dataUrlMime(out) === 'image/webp') {
      converted += 1;
      return out;
    }
    kept += 1;
    return url;
  };

  const thumbnail = world.worldOverview?.thumbnail;
  const nextThumbnail = thumbnail ? await convert(thumbnail) : thumbnail;

  // Each slice keeps its identity unless this run actually rebuilt it, so the write-back touches only what
  // changed — and an entity whose pictures were all left alone never has its legacy `image` field normalized
  // into `images` as a side effect of fixing a different one.
  let entitiesChanged = false;
  const entities: RuleWorld['entities'] = [];
  for (const entity of world.entities ?? []) {
    const images: string[] = [];
    let touched = false;
    for (const url of entityImages(entity)) {
      const next = await convert(url);
      if (next !== url) touched = true;
      images.push(next);
    }
    entitiesChanged ||= touched;
    entities.push(touched ? { ...entity, images } : entity);
  }

  let locationsChanged = false;
  const locations: RuleWorld['locations'] = [];
  for (const location of world.locations ?? []) {
    const next = location.backgroundImage ? await convert(location.backgroundImage) : location.backgroundImage;
    const touched = next !== location.backgroundImage;
    locationsChanged ||= touched;
    locations.push(touched ? { ...location, backgroundImage: next } : location);
  }

  const thumbnailChanged = nextThumbnail !== thumbnail;
  // Nothing converted means nothing to write back: handing the same world reference back is what lets the
  // caller skip the write entirely, so a run that changed nothing never marks the world dirty.
  if (!thumbnailChanged && !entitiesChanged && !locationsChanged) {
    return { world, converted, kept, skippedAnimated };
  }

  return {
    world: {
      ...world,
      ...(thumbnailChanged ? { worldOverview: { ...world.worldOverview, thumbnail: nextThumbnail ?? null } } : {}),
      ...(entitiesChanged ? { entities } : {}),
      ...(locationsChanged ? { locations } : {}),
    },
    converted,
    kept,
    skippedAnimated,
  };
}

/** GIFs this browser can't re-encode without flattening, said as the reason it is rather than folded in
 *  with the images WebP simply wouldn't shrink — those two rows clear on different days. */
const describeSkippedAnimated = (skipped: number): string => {
  if (skipped <= 0) return '';
  return skipped === 1
    ? 'Left 1 GIF alone — converting it in this browser would flatten its animation.'
    : `Left ${skipped} GIFs alone — converting them in this browser would flatten their animation.`;
};

/** What to tell the author a run did. Empty when it converted everything it looked at — the row clearing
 *  already says so — and otherwise one line per reason anything is still there. */
export function describeWebpFixRun({ converted, kept, skippedAnimated }: WebpFixRun): string {
  const reasons = [describeKeptImages(kept), describeSkippedAnimated(skippedAnimated)].filter(Boolean);
  if (reasons.length === 0) return '';
  const done = converted === 1 ? 'Converted 1 image to WebP.' : `Converted ${converted} images to WebP.`;
  return [...(converted > 0 ? [done] : []), ...reasons].join(' ');
}
