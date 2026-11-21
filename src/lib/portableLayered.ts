// Layered Images across the world boundary: a world links its rig's images by id, the portable form (library,
// card, publish) embeds them named as their entries. Convert at the boundary, as galleries do.

import type {
  EmbeddedLayeredImage, GalleryLink, LayerBlend, LayeredMediaEntry, LayerVariant, MediaLayer, MediaList, PortableLayer, PortableLayered,
  PortableLayerVariant, TraitRequirement, TraitRequirementRow,
} from '@/types';
import { layeredEntry, mediaEntry, resolveGalleryImage, uniqueMediaName } from './mediaList';
import { outsidePlayLayered, type LayeredPicture } from './layeredImages';
import { mapConditions } from './requirementRows';
import type { MascotTransition } from './formaquestion/mascotTransition';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Whether a gallery slot holds an embedded Layered Image. */
export const isEmbeddedLayered = (link: GalleryLink): link is EmbeddedLayeredImage => 'layered' in link;

/** The rig as it travels, each Variant's image embedded under its entry's name; a missing image's Variant drops. */
export function embedLayered(entry: LayeredMediaEntry, list: MediaList | undefined): PortableLayered {
  return {
    name: entry.name,
    layers: entry.layers.map(({ variants, ...layer }): PortableLayer => ({
      ...layer,
      variants: variants.flatMap((variant): PortableLayerVariant[] => {
        const image = mediaEntry(list, variant.mediaId, 'image');
        return image ? [{ data: image.data, name: image.name, ...(variant.requires?.length ? { requires: variant.requires } : {}) }] : [];
      }),
    })),
  };
}

/** A gallery link with a world Layered Image turned into its embedded form, rule kept; any other link as it is. */
export function embedLayeredLink(link: GalleryLink, list: MediaList | undefined): GalleryLink {
  const entry = 'mediaId' in link ? layeredEntry(list, link.mediaId) : undefined;
  return entry ? { layered: embedLayered(entry, list), ...(link.requires?.length ? { requires: link.requires } : {}) } : link;
}

/** A gallery as it travels: images and rigs embedded, rules kept, and a link the list lacks dropped. */
export const portableGallery = (links: readonly GalleryLink[], list: MediaList | undefined): GalleryLink[] =>
  links.flatMap((link): GalleryLink[] => {
    const embedded = embedLayeredLink(link, list);
    if (embedded !== link || isEmbeddedLayered(link)) return [embedded];
    const image = resolveGalleryImage(link, list);
    return image ? [image] : [];
  });

/** The rig with `map` over every Variant. */
export const mapVariants = (layered: PortableLayered, map: (variant: PortableLayerVariant) => PortableLayerVariant): PortableLayered => ({
  ...layered,
  layers: layered.layers.map((layer) => ({ ...layer, variants: layer.variants.map(map) })),
});

/** Every Variant image the rig embeds. */
export const variantImages = (layered: PortableLayered): string[] => layered.layers.flatMap((layer) => layer.variants.map((v) => v.data));

/** The rig with `map` over every Condition of its Variants' rules. */
export const mapLayeredRules = (layered: PortableLayered, map: (req: TraitRequirement) => TraitRequirement): PortableLayered =>
  mapVariants(layered, (v) => (v.requires?.length ? { ...v, requires: mapConditions(v.requires, map) } : v));

/** Whether any Variant of the rig carries a rule. */
export const hasLayeredRules = (layered: PortableLayered): boolean =>
  layered.layers.some((layer) => layer.variants.some((v) => !!v.requires?.length));

/** Places one Variant's image into a list, returning the list and the id that holds it. */
export type PlaceVariant = (list: MediaList, variant: PortableLayerVariant, layerName: string) => { list: MediaList; id: string };

/** A value with its object keys sorted, so two equal rigs stringify the same whatever order their fields were written in. */
export const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
};

/** What two rigs compare by: every Layer, its name, id, Variant ids and rules included; the rig's own name aside. */
const rigKey = (layers: readonly MediaLayer[]): string => JSON.stringify(sorted(layers));

/**
 * The list with `layered` in it and the id of its entry. Each Variant's image places through `placeVariant`, so a
 * byte-identical image reuses its entry. A layered entry equal after placement is reused under the world's name; otherwise a new one joins
 * under a unique name with the id `newId` gives.
 */
export function placeLayered(
  list: MediaList, layered: PortableLayered, placeVariant: PlaceVariant, newId: (list: MediaList, key: string) => string,
): { list: MediaList; id: string } {
  let next = list;
  const layers = layered.layers.map(({ variants, ...layer }): MediaLayer => ({
    ...layer,
    variants: variants.map((variant): LayerVariant => {
      const placed = placeVariant(next, variant, layer.name);
      next = placed.list;
      return { mediaId: placed.id, ...(variant.requires?.length ? { requires: variant.requires } : {}) };
    }),
  }));
  const key = rigKey(layers);
  const held = Object.values(next).find((entry) => entry.kind === 'layered' && rigKey(entry.layers) === key);
  if (held) return { list: next, id: held.id };
  const id = newId(next, key);
  const entry: LayeredMediaEntry = { id, name: uniqueMediaName(layered.name, next), kind: 'layered', layers };
  return { list: { ...next, [id]: entry }, id };
}

/** The entry id a portable rig resolves under, apart from any world. */
const PORTABLE_ID = 'portable';

/** A portable rig as a world entry over its own list, so the world-form readers draw it. */
export function portableAsEntry(layered: PortableLayered): { entry: LayeredMediaEntry; list: MediaList } {
  const list: MediaList = {};
  const layers = layered.layers.map(({ variants, ...layer }, l): MediaLayer => ({
    ...layer,
    variants: variants.map((variant, v): LayerVariant => {
      const id = `${PORTABLE_ID}-${l}-${v}`;
      list[id] = { id, name: variant.name ?? id, kind: 'image', data: variant.data };
      return { mediaId: id, ...(variant.requires?.length ? { requires: variant.requires } : {}) };
    }),
  }));
  const entry: LayeredMediaEntry = { id: PORTABLE_ID, name: layered.name, kind: 'layered', layers };
  return { entry, list: { ...list, [PORTABLE_ID]: entry } };
}

/** A portable rig's outside-play picture: each Layer's first Variant (Q5). Undefined when nothing sets the canvas. */
export function portableOutsidePlay(layered: PortableLayered): LayeredPicture | undefined {
  const { entry, list } = portableAsEntry(layered);
  return outsidePlayLayered(entry, list);
}

const stringField = (raw: Record<string, unknown>, key: string): Record<string, string> =>
  (typeof raw[key] === 'string' && raw[key] ? { [key]: raw[key] as string } : {});

const BLENDS: ReadonlySet<string> = new Set<LayerBlend>(['normal', 'multiply', 'screen', 'add']);

const rulesOf = (raw: Record<string, unknown>): { requires?: TraitRequirementRow[] } =>
  (Array.isArray(raw.requires) && raw.requires.length ? { requires: raw.requires as TraitRequirementRow[] } : {});

/** A stored or carried rig in its canonical form, or null when it holds no Layer list. Variants without data drop. */
export function readPortableLayered(raw: unknown): PortableLayered | null {
  if (!isRecord(raw) || !Array.isArray(raw.layers)) return null;
  const layers = raw.layers.flatMap((layer): PortableLayer[] => {
    if (!isRecord(layer) || typeof layer.id !== 'string' || typeof layer.name !== 'string') return [];
    const variants = (Array.isArray(layer.variants) ? layer.variants : []).flatMap((v): PortableLayerVariant[] =>
      (isRecord(v) && typeof v.data === 'string' && v.data ? [{ data: v.data, ...stringField(v, 'name'), ...rulesOf(v) }] : []));
    const { opacity, tint, blend, transition } = layer;
    return [{
      id: layer.id, name: layer.name,
      ...(typeof opacity === 'number' && Number.isFinite(opacity) ? { opacity } : {}),
      ...(typeof tint === 'string' && tint ? { tint } : {}),
      ...(typeof blend === 'string' && BLENDS.has(blend) ? { blend: blend as LayerBlend } : {}),
      // Play holds a stored transition to the Mascot's ranges.
      ...(isRecord(transition) ? { transition: transition as unknown as MascotTransition } : {}),
      variants,
    }];
  });
  return { name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Layered Image', layers };
}
