/**
 * Turn a world's linked images into embedded ones for a self-contained export.
 *
 * Only the export's own copy is rewritten — the editor state and the stored world keep their links, exactly as
 * the downscale-on-export pass does. Publishing never runs this: keeping a published world's images remote is
 * the point of linking them.
 */
import type { Body, GalleryImage, GalleryLink, World } from '@/types';
import { isEmbeddedImage, isMediaRef } from './mediaList';
import { IMAGE_CAPS, type ImageCap } from './imageOptim';
import { embeddedImageFiles, galleryLinks } from './entityImages';
import { locationLinks, rewriteMediaImages } from './mediaGallery';
import { worldOptimizeTargets } from './mediaIndex';
import { rewriteMapImages } from './mapBackground';
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
  if (typeof thumb === 'string' && isRemoteImage(thumb)) urls.push(thumb);
  // A linked entry counts once, however many places link it.
  const embeddedData = (links: GalleryLink[]) => links.flatMap((link) => (isEmbeddedImage(link) ? [link.data] : []));
  for (const e of world.entities ?? []) urls.push(...embeddedData(galleryLinks(e)).filter(isRemoteImage));
  for (const l of world.locations ?? []) urls.push(...embeddedData(locationLinks(l)).filter(isRemoteImage));
  for (const entry of Object.values(world.worldOverview?.mediaList ?? {})) if (entry.kind === 'image' && isRemoteImage(entry.data)) urls.push(entry.data);
  urls.push(...embeddedData(galleryLinks({ images: world.worldOverview?.mapBackground?.images })).filter(isRemoteImage));
  for (const b of world.bodies ?? []) {
    const data = b.backdrop.kind === 'image' && isEmbeddedImage(b.backdrop.image) ? b.backdrop.image.data : undefined;
    if (data && isRemoteImage(data)) urls.push(data);
  }
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
  if (Array.isArray(item.images)) urls.push(...embeddedImageFiles(item as { images?: GalleryImage[] }).filter(isRemoteImage));
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

  const cover = world.worldOverview?.thumbnail;
  const thumbnail = isMediaRef(cover) ? cover : await embed(cover, IMAGE_CAPS.thumbnail);
  // Links keep their ids: their entries are embedded once, below.
  const embedGallery = async (links: GalleryLink[], cap: ImageCap): Promise<GalleryLink[]> => {
    const out: GalleryLink[] = [];
    for (const link of links) out.push(!isEmbeddedImage(link) ? link : { ...link, data: (await embed(link.data, cap)) ?? link.data });
    return out;
  };
  const entities: World['entities'] = [];
  for (const e of world.entities ?? []) entities.push({ ...e, images: await embedGallery(galleryLinks(e), IMAGE_CAPS.entity) });
  const locations: World['locations'] = [];
  for (const l of world.locations ?? []) locations.push({ ...l, images: await embedGallery(locationLinks(l), IMAGE_CAPS.background) });
  const budgets = new Map(worldOptimizeTargets(world).entries.map((entry) => [entry.id, entry.budget]));
  const mediaList = await rewriteMediaImages(world.worldOverview?.mediaList,
    async (data, entry) => (await embed(data, budgets.get(entry.id) ?? IMAGE_CAPS.entity)) ?? data);

  const bodies: Body[] = [];
  for (const b of world.bodies ?? []) {
    if (b.backdrop.kind !== 'image' || !isEmbeddedImage(b.backdrop.image)) { bodies.push(b); continue; }
    const { image } = b.backdrop;
    bodies.push({ ...b, backdrop: { ...b.backdrop, image: { ...image, data: (await embed(image.data, IMAGE_CAPS.entity)) ?? image.data } } });
  }

  const map = await rewriteMapImages(world.worldOverview, async (data) => (await embed(data, IMAGE_CAPS.map)) ?? data);

  return {
    world: {
      ...world,
      worldOverview: {
        ...world.worldOverview,
        thumbnail: thumbnail ?? null,
        ...map,
        ...(mediaList ? { mediaList } : {}),
      },
      entities,
      locations,
      ...(world.bodies ? { bodies } : {}),
    },
    failures,
  };
}
