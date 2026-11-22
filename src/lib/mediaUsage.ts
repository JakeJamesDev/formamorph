import type { MediaList, TraitRequirementRow } from '@/types';
import { bodyLabel } from './bodies';
import { galleryLink } from './entityImages';
import { isMediaRef } from './mediaList';
import { MAP_PARENT, type MediaParent, type MediaWorld } from './mediaIndex';

/** The field of its owner a link sits in. */
export type MediaUseField = 'images' | 'sound' | 'ambientSound' | 'backdrop' | 'thumbnail' | 'bgm';

/** One place that links a Media Entry. `index` is the gallery position. */
export interface MediaUse {
  owner: MediaParent;
  field: MediaUseField;
  index?: number;
  /** The link's Visibility rule rows (Q11). */
  requires?: TraitRequirementRow[];
}

const WORLD_OWNER: MediaParent = { kind: 'world', id: 'world', name: 'World' };

const FIELD_LABELS: Record<Exclude<MediaUseField, 'images'>, string> = {
  sound: 'Sound', ambientSound: 'Ambient Sound', backdrop: 'Backdrop', thumbnail: 'Cover', bgm: 'Music',
};

/** One use as copy names it: "Wren, Image 2", "World, Cover". `ownerName` labels the owner's placeholders. */
export function mediaUseLabel(use: MediaUse, ownerName: (name: string) => string = (name) => name): string {
  const slot = use.field === 'images' ? `Image ${(use.index ?? 0) + 1}` : FIELD_LABELS[use.field];
  return `${ownerName(use.owner.name) || 'Unnamed'}, ${slot}`;
}

/** Each Media Entry id with every entity, location, item, map, backdrop and world field that links it, in world order. */
export function mediaUsage(w: MediaWorld): Map<string, MediaUse[]> {
  const usage = new Map<string, MediaUse[]>();
  const add = (id: string, use: MediaUse) => usage.set(id, [...(usage.get(id) ?? []), use]);
  // Single fields take a link before their declared types widen, so they are read as unknown.
  const single = (owner: MediaParent, field: MediaUseField, value: unknown) => {
    if (isMediaRef(value)) add(value.mediaId, { owner, field });
  };
  // `index` is the stored position, blanks included.
  const gallery = (owner: MediaParent, images: readonly unknown[] | undefined) => images?.forEach((raw, index) => {
    const link = galleryLink(raw);
    if (link && 'mediaId' in link) add(link.mediaId, { owner, field: 'images', index, ...(link.requires ? { requires: link.requires } : {}) });
  });

  single(WORLD_OWNER, 'thumbnail', w.worldOverview.thumbnail);
  single(WORLD_OWNER, 'bgm', w.worldOverview.bgm);
  gallery(MAP_PARENT, w.worldOverview.mapBackground?.images);
  for (const e of w.entities) {
    const owner: MediaParent = { kind: 'entity', id: e.id, name: e.name };
    gallery(owner, e.images);
    single(owner, 'sound', e.sound);
  }
  for (const l of w.locations) {
    const owner: MediaParent = { kind: 'location', id: l.id, name: l.name };
    gallery(owner, l.images);
    single(owner, 'ambientSound', l.ambientSound);
  }
  for (const item of w.items ?? []) gallery({ kind: 'item', id: item.id, name: item.name }, item.images);
  for (const b of w.bodies ?? []) {
    if (b.backdrop.kind === 'image') single({ kind: 'body', id: b.id, name: bodyLabel(b) }, 'backdrop', b.backdrop.image);
  }
  return usage;
}

/** One Layer that holds an image as a Variant. */
export interface VariantUse {
  entryId: string;
  entryName: string;
  layerId: string;
  layerName: string;
}

/** A Variant use as copy names it: "Scout Rig · Face". */
export const variantUseLabel = (use: VariantUse): string => `${use.entryName || 'Unnamed'} · ${use.layerName || 'Unnamed'}`;

/** Each image entry id with every Layer that holds it as a Variant, in list and Layer order. */
export function variantUsage(list: MediaList | undefined): Map<string, VariantUse[]> {
  const usage = new Map<string, VariantUse[]>();
  for (const entry of Object.values(list ?? {})) {
    if (entry.kind !== 'layered') continue;
    for (const layer of entry.layers) {
      for (const mediaId of new Set(layer.variants.map((v) => v.mediaId))) {
        usage.set(mediaId, [...(usage.get(mediaId) ?? []), { entryId: entry.id, entryName: entry.name, layerId: layer.id, layerName: layer.name }]);
      }
    }
  }
  return usage;
}

/** The images Layered Image `id` holds as Variants that nothing else uses, in list order. */
export function unsharedParts(w: MediaWorld, id: string): string[] {
  const list = w.worldOverview.mediaList;
  const entry = list?.[id];
  if (entry?.kind !== 'layered') return [];
  const fields = mediaUsage(w);
  const variants = variantUsage(list);
  const held = new Set(entry.layers.flatMap((l) => l.variants.map((v) => v.mediaId)));
  return Object.keys(list ?? {}).filter((part) => held.has(part)
    && !fields.has(part)
    && (variants.get(part) ?? []).every((use) => use.entryId === id));
}
