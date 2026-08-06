/**
 * Turn a world's linked images into embedded ones for a self-contained export.
 *
 * Only the export's own copy is rewritten — the editor state and the stored world keep their links, exactly as
 * the downscale-on-export pass does. Publishing never runs this: keeping a published world's images remote is
 * the point of linking them.
 */
import type { World } from '@/types';
import { IMAGE_CAPS, type ImageCap } from './imageOptim';
import { entityImages } from './entityImages';
import { isRemoteImage } from './imageBytes';
import { fetchAsDataUrl } from './imageSource';

/** One image that could not be downloaded, with the reason to show the author. */
export interface EmbedFailure {
  url: string;
  reason: string;
}

/** Every linked image in a world. The count drives whether the export dialog is worth showing at all. */
export function remoteWorldImages(world: World): string[] {
  const urls: string[] = [];
  const thumb = world.worldOverview?.thumbnail;
  if (isRemoteImage(thumb)) urls.push(thumb as string);
  for (const e of world.entities ?? []) urls.push(...entityImages(e).filter(isRemoteImage));
  for (const l of world.locations ?? []) if (isRemoteImage(l.backgroundImage)) urls.push(l.backgroundImage as string);
  return urls;
}

/**
 * Every linked image in anything publishable — a world, a single entity, or a dictionary. Shapes are probed
 * rather than switched on `kind` so one function covers all three publish payloads.
 */
export function remoteImagesInContent(content: unknown): string[] {
  const item = (content ?? {}) as Partial<World> & { images?: unknown; thumbnail?: unknown };
  const urls = remoteWorldImages(item as World);
  // A character card publishes the entity itself, whose pictures aren't under `entities`.
  if (Array.isArray(item.images)) urls.push(...entityImages(item as { images?: string[] }).filter(isRemoteImage));
  // A dictionary's cover sits at the top level rather than under `worldOverview`.
  if (isRemoteImage(item.thumbnail as string)) urls.push(item.thumbnail as string);
  return urls;
}

/**
 * Download every linked image and return a world carrying the bytes instead. Images that cannot be downloaded
 * keep their link and are reported, so the author decides whether to export anyway rather than getting a file
 * that is quietly missing pictures.
 *
 * Sequential to match the downscale pass: the same encode worker serializes the optimize step anyway, and one
 * at a time is what lets `signal` stop the run between images.
 */
export async function embedWorldRemoteImages(
  world: World,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ world: World; failures: EmbedFailure[] }> {
  const total = remoteWorldImages(world).length;
  const failures: EmbedFailure[] = [];
  let done = 0;
  onProgress?.(0, total);

  const embed = async (url: string | undefined | null, cap: ImageCap): Promise<string | undefined | null> => {
    if (!isRemoteImage(url)) return url;
    if (signal?.aborted) throw new DOMException('Export canceled', 'AbortError');
    const remote = url as string;
    try {
      const embedded = await fetchAsDataUrl(remote, cap);
      onProgress?.(++done, total);
      return embedded;
    } catch (error) {
      failures.push({ url: remote, reason: (error as Error).message });
      onProgress?.(++done, total);
      return remote; // keep the link rather than emptying the slot
    }
  };

  const thumbnail = await embed(world.worldOverview?.thumbnail, IMAGE_CAPS.thumbnail);
  const entities: World['entities'] = [];
  for (const e of world.entities ?? []) {
    const images: string[] = [];
    for (const url of entityImages(e)) images.push((await embed(url, IMAGE_CAPS.entity)) ?? url);
    entities.push({ ...e, images });
  }
  const locations: World['locations'] = [];
  for (const l of world.locations ?? []) {
    locations.push({ ...l, backgroundImage: (await embed(l.backgroundImage, IMAGE_CAPS.background)) ?? undefined });
  }

  return {
    world: { ...world, worldOverview: { ...world.worldOverview, thumbnail: thumbnail ?? null }, entities, locations },
    failures,
  };
}
