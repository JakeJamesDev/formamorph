// Authoring a Layered Image: pure edits on one entry, each returning a new entry. Layers are bottom first.

import type { LayerBlend, LayeredMediaEntry, LayerVariant, MediaLayer, MediaList, TraitRequirementRow } from '@/types';
import { normalizeTint } from './layeredImages';
import { mediaNameKey, uniqueMediaName } from './mediaList';
import { randomUUID } from './uuid';

/** A new, empty Layered Image whose name is free in `list`. */
export const newLayeredEntry = (list: MediaList | undefined, id: string = randomUUID()): LayeredMediaEntry =>
  ({ id, name: uniqueMediaName('Layered Image', list), kind: 'layered', layers: [] });

/** `name`, or `name (2)`, `name (3)`… when another Layer of the entry holds it (Q14). */
export function uniqueLayerName(name: string, layers: readonly MediaLayer[], exceptId?: string): string {
  const base = name.trim();
  const taken = new Set(layers.filter((l) => l.id !== exceptId).map((l) => mediaNameKey(l.name)));
  if (!taken.has(mediaNameKey(base))) return base;
  let n = 2;
  while (taken.has(mediaNameKey(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}

const withLayers = (entry: LayeredMediaEntry, layers: MediaLayer[]): LayeredMediaEntry => ({ ...entry, layers });

const mapLayer = (entry: LayeredMediaEntry, layerId: string, edit: (layer: MediaLayer) => MediaLayer): LayeredMediaEntry =>
  withLayers(entry, entry.layers.map((l) => (l.id === layerId ? edit(l) : l)));

const moved = <T,>(list: readonly T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** The entry with a new top Layer named "Layer" (made unique), and that Layer's id. */
export function addLayer(entry: LayeredMediaEntry, id: string = randomUUID()): { entry: LayeredMediaEntry; layerId: string } {
  const layer: MediaLayer = { id, name: uniqueLayerName('Layer', entry.layers), variants: [] };
  return { entry: withLayers(entry, [...entry.layers, layer]), layerId: id };
}

/** The entry with the Layer renamed, made unique. A blank name leaves it. */
export const renameLayer = (entry: LayeredMediaEntry, layerId: string, name: string): LayeredMediaEntry =>
  (name.trim() ? mapLayer(entry, layerId, (l) => ({ ...l, name: uniqueLayerName(name, entry.layers, layerId) })) : entry);

export const removeLayer = (entry: LayeredMediaEntry, layerId: string): LayeredMediaEntry =>
  withLayers(entry, entry.layers.filter((l) => l.id !== layerId));

/** The entry with the Layer at bottom-first index `from` moved to `to`. */
export const moveLayer = (entry: LayeredMediaEntry, from: number, to: number): LayeredMediaEntry =>
  withLayers(entry, moved(entry.layers, from, to));

/** The entry with the Layer's opacity set, 0 to 1. Full opacity is stored as absent. */
export const setLayerOpacity = (entry: LayeredMediaEntry, layerId: string, opacity: number): LayeredMediaEntry =>
  mapLayer(entry, layerId, ({ opacity: _old, ...rest }) => {
    const value = Math.min(1, Math.max(0, opacity));
    return value >= 1 ? rest : { ...rest, opacity: value };
  });

/** The entry with the Layer's tint set. White, or a value that is not `#rrggbb`, clears it. */
export const setLayerTint = (entry: LayeredMediaEntry, layerId: string, tint: string | null): LayeredMediaEntry =>
  mapLayer(entry, layerId, ({ tint: _old, ...rest }) => {
    const value = normalizeTint(tint ?? undefined);
    return value ? { ...rest, tint: value } : rest;
  });

/** The entry with the Layer's blend mode set. Normal is stored as absent. */
export const setLayerBlend = (entry: LayeredMediaEntry, layerId: string, blend: LayerBlend): LayeredMediaEntry =>
  mapLayer(entry, layerId, ({ blend: _old, ...rest }) => (blend === 'normal' ? rest : { ...rest, blend }));

/** The entry with `mediaIds` added as the Layer's last Variants. An image the Layer already holds is not added twice. */
export const addVariants = (entry: LayeredMediaEntry, layerId: string, mediaIds: readonly string[]): LayeredMediaEntry =>
  mapLayer(entry, layerId, (l) => {
    const held = new Set(l.variants.map((v) => v.mediaId));
    const fresh = [...new Set(mediaIds)].filter((id) => !held.has(id));
    return fresh.length ? { ...l, variants: [...l.variants, ...fresh.map((mediaId): LayerVariant => ({ mediaId }))] } : l;
  });

export const removeVariant = (entry: LayeredMediaEntry, layerId: string, index: number): LayeredMediaEntry =>
  mapLayer(entry, layerId, (l) => ({ ...l, variants: l.variants.filter((_, i) => i !== index) }));

export const moveVariant = (entry: LayeredMediaEntry, layerId: string, from: number, to: number): LayeredMediaEntry =>
  mapLayer(entry, layerId, (l) => ({ ...l, variants: moved(l.variants, from, to) }));

/** The entry with the Variant's Visibility rule set. No rows stores no rule. */
export const setVariantRule = (entry: LayeredMediaEntry, layerId: string, index: number, rows: TraitRequirementRow[]): LayeredMediaEntry =>
  mapLayer(entry, layerId, (l) => ({
    ...l,
    variants: l.variants.map((v, i) => (i !== index ? v : rows.length ? { ...v, requires: rows } : { mediaId: v.mediaId })),
  }));

/** The list without any Variant that links `mediaId`; an emptied Layer stays (Q28). The same list when none did. */
export function listWithoutVariant(list: MediaList | undefined, mediaId: string): MediaList | undefined {
  if (!list) return list;
  let out = list;
  for (const entry of Object.values(list)) {
    if (entry.kind !== 'layered' || !entry.layers.some((l) => l.variants.some((v) => v.mediaId === mediaId))) continue;
    const layers = entry.layers.map((l) => (l.variants.some((v) => v.mediaId === mediaId)
      ? { ...l, variants: l.variants.filter((v) => v.mediaId !== mediaId) } : l));
    out = { ...out, [entry.id]: { ...entry, layers } };
  }
  return out;
}
