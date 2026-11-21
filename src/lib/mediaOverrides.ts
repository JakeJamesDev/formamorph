// The Media Entries scripts set in play (Q2, Q49–Q53): their writes, how they lay over the save, and how play reads them.

import type {
  EntityMediaOverride, GenericStates, LayerSetting, LayerSettings, MediaEntry, MediaLayerSettings, MediaList, MediaOverrides, MediaRef, PersonaRef,
} from '@/types';
import { heldVariant, layeredEntry } from './mediaList';

/** The script members that take a Media Entry's name, by the entry they sit on. */
export const MEDIA_NAME_MEMBERS = {
  /** On `entities.X`, `persona`, `owner` and each entry of `entities.X.instances`. */
  entity: ['image', 'sound'],
  /** On `locations.X` and `location`. */
  location: ['image', 'ambience'],
  /** On each Item Instance entry. */
  itemInstance: ['image'],
  /** On `world`. */
  world: ['music'],
} as const;

/** The entry kind each member takes. */
export const MEDIA_MEMBER_KIND = { image: 'image', sound: 'sound', ambience: 'sound', music: 'sound' } as const satisfies Record<string, MediaEntry['kind']>;

export type MediaField = keyof typeof MEDIA_MEMBER_KIND;

/** Who a media write is for. An entity id of `''` is the played persona. */
export type MediaOwner =
  | { kind: 'entity'; id: string }
  | { kind: 'instance'; entityId: string; startId: string }
  | { kind: 'location'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'world' };

/** One script assignment to a media member: an entry id, or null to clear. */
export interface MediaEntryWrite {
  owner: MediaOwner;
  field: MediaField;
  mediaId: string | null;
}

/** A Layer member a script sets (Q10). */
export type LayerField = keyof LayerSetting;

/** Who a Layer write is for: any media owner but `world`. */
export type LayerOwner = Exclude<MediaOwner, { kind: 'world' }>;

/** One script assignment to a Layer of a Layered Image: the value, or null to clear. */
export interface LayerWrite {
  owner: LayerOwner;
  entryId: string;
  layerId: string;
  field: LayerField;
  value: string | number | null;
}

/** One script assignment the media write path carries. */
export type MediaWrite = MediaEntryWrite | LayerWrite;

export const isLayerWrite = (write: MediaWrite): write is LayerWrite => 'layerId' in write;

type Row = Record<string, string>;

/** `row` with `field` set to `id`, or without it for null; undefined when nothing is left. */
function rowWith(row: Row | undefined, field: string, id: string | null): Row | undefined {
  const { [field]: _gone, ...rest } = row ?? {};
  const next: Row = id === null ? rest : { ...rest, [field]: id };
  return Object.keys(next).length ? next : undefined;
}

/** `map` with `key` holding `value`, or without it when undefined; undefined when empty. */
function keyedWith<T>(map: Record<string, T> | undefined, key: string, value: T | undefined): Record<string, T> | undefined {
  const { [key]: _gone, ...rest } = map ?? {};
  const next = value === undefined ? rest : { ...rest, [key]: value };
  return Object.keys(next).length ? next : undefined;
}

/** `settings` with `write`'s field set or cleared; undefined when nothing is left. */
function settingsWith(settings: LayerSettings | undefined, { entryId, layerId, field, value }: LayerWrite): LayerSettings | undefined {
  const byLayer = settings?.[entryId];
  const { [field]: _gone, ...rest } = byLayer?.[layerId] ?? {};
  const next: LayerSetting = value === null ? rest : { ...rest, [field]: value };
  return keyedWith(settings, entryId, keyedWith(byLayer, layerId, Object.keys(next).length ? next : undefined));
}

/** `layers` with `write` laid on; undefined when no setting is left. */
function withLayerWrite(layers: MediaLayerSettings | undefined, write: LayerWrite): MediaLayerSettings | undefined {
  const { owner } = write;
  const next: MediaLayerSettings = { ...layers };
  switch (owner.kind) {
    case 'entity':
      next.entities = keyedWith(layers?.entities, owner.id, settingsWith(layers?.entities?.[owner.id], write));
      break;
    case 'instance': {
      const byStart = layers?.instances?.[owner.entityId];
      next.instances = keyedWith(layers?.instances, owner.entityId, keyedWith(byStart, owner.startId, settingsWith(byStart?.[owner.startId], write)));
      break;
    }
    case 'location':
      next.locations = keyedWith(layers?.locations, owner.id, settingsWith(layers?.locations?.[owner.id], write));
      break;
    case 'item':
      next.items = keyedWith(layers?.items, owner.id, settingsWith(layers?.items?.[owner.id], write));
      break;
  }
  const kept = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
  return Object.keys(kept).length ? kept : undefined;
}

/** `overrides` with `write` laid on. */
function withMediaWrite(overrides: MediaOverrides, write: MediaWrite): MediaOverrides {
  if (isLayerWrite(write)) {
    const { layers, ...others } = overrides;
    const next = withLayerWrite(layers, write);
    return next ? { ...others, layers: next } : others;
  }
  const { owner, field, mediaId } = write;
  const { entities, instances, locations, items, music, ...rest } = overrides;
  const next: MediaOverrides = { ...rest };
  let nextEntities = entities;
  let nextInstances = instances;
  let nextLocations = locations;
  let nextItems = items;
  let nextMusic = music;
  switch (owner.kind) {
    case 'entity':
      nextEntities = keyedWith(entities, owner.id, rowWith(entities?.[owner.id] as Row | undefined, field, mediaId));
      break;
    case 'instance': {
      const byStart = instances?.[owner.entityId];
      nextInstances = keyedWith(instances, owner.entityId, keyedWith(byStart, owner.startId, rowWith(byStart?.[owner.startId] as Row | undefined, field, mediaId)));
      break;
    }
    case 'location':
      nextLocations = keyedWith(locations, owner.id, rowWith(locations?.[owner.id] as Row | undefined, field, mediaId));
      break;
    case 'item':
      nextItems = keyedWith(items, owner.id, mediaId ?? undefined);
      break;
    case 'world':
      nextMusic = mediaId ?? undefined;
      break;
  }
  return {
    ...next,
    ...(nextEntities && { entities: nextEntities }), ...(nextInstances && { instances: nextInstances }),
    ...(nextLocations && { locations: nextLocations }), ...(nextItems && { items: nextItems }),
    ...(nextMusic !== undefined && { music: nextMusic }),
  };
}

/** `overrides` with `writes` laid on in order, so the later write wins. The same object when there are none. */
export function withMediaWrites(overrides: MediaOverrides, writes: readonly MediaWrite[] | undefined): MediaOverrides {
  return writes?.length ? writes.reduce(withMediaWrite, overrides) : overrides;
}

/** Whether an entry of `kind` fits a member taking `wanted`: an image member also takes a Layered Image (Q24). */
export const kindFits = (kind: MediaEntry['kind'] | undefined, wanted: MediaEntry['kind']): boolean =>
  kind === wanted || (wanted === 'image' && kind === 'layered');

/** `id` when the list holds an entry fitting `kind` under it; an override naming a deleted entry reads as unset (Q19). */
export const liveMediaId = (list: MediaList | undefined, id: string | undefined, kind: MediaEntry['kind']): string | undefined =>
  (id && kindFits(list?.[id]?.kind, kind) ? id : undefined);

/** Which entity an override applies to: its id (`''` for the played persona) and, for a Generic entity, the Start
 *  of the Generic Entity Instance shown. */
export interface EntityMediaKey {
  key: string;
  entityId?: string;
  startId?: string;
}

/** The entity's override for `field`: its Generic Entity Instance's first, then the entity-wide one (Q50). */
export function entityOverrideId(
  overrides: MediaOverrides | undefined, list: MediaList | undefined, { key, entityId, startId }: EntityMediaKey, field: keyof EntityMediaOverride,
): string | undefined {
  const kind = MEDIA_MEMBER_KIND[field];
  const instance = entityId && startId ? overrides?.instances?.[entityId]?.[startId]?.[field] : undefined;
  return liveMediaId(list, instance, kind) ?? liveMediaId(list, overrides?.entities?.[key]?.[field], kind);
}

/** The Start of the Generic Entity Instance standing at `locationId`, first by Start order (Q50). */
export function instanceAt(states: GenericStates | undefined, entityId: string, locationId: string | undefined): string | undefined {
  if (!locationId) return undefined;
  return Object.entries(states?.[entityId] ?? {}).find(([, state]) => state.position === locationId)?.[0];
}

/** Where play stands, which decides whose override an entity shows. */
export interface MediaOverrideScene {
  genericStates?: GenericStates;
  /** The player's location, where a Generic entity shows the instance standing there. */
  locationId?: string;
  /** The played persona entity's id, whose override sits under the empty key. */
  personaId?: string;
}

/** `settings` without any `variant` its Layer no longer holds, so a stale one reads as unset before a merge (Q32). */
function withoutStaleVariants(settings: LayerSettings | undefined, list: MediaList | undefined): LayerSettings | undefined {
  if (!settings) return settings;
  return Object.fromEntries(Object.entries(settings).map(([entryId, byLayer]) => {
    const layers = layeredEntry(list, entryId)?.layers;
    return [entryId, Object.fromEntries(Object.entries(byLayer).map(([layerId, setting]) => {
      const layer = layers?.find((one) => one.id === layerId);
      if (setting.variant === undefined || (layer && heldVariant(layer, list, setting.variant))) return [layerId, setting];
      const { variant: _stale, ...rest } = setting;
      return [layerId, rest];
    }))];
  }));
}

/** `top` laid over `base` field by field, per Layered Image and Layer. */
function settingsOver(base: LayerSettings | undefined, top: LayerSettings | undefined): LayerSettings | undefined {
  if (!base || !top) return top ?? base;
  const out: LayerSettings = { ...base };
  for (const [entryId, byLayer] of Object.entries(top)) {
    const merged = { ...base[entryId] };
    for (const [layerId, setting] of Object.entries(byLayer)) merged[layerId] = { ...merged[layerId], ...setting };
    out[entryId] = merged;
  }
  return out;
}

/** The entity's Layer settings: its Generic Entity Instance's over the entity-wide ones, field by field (Q31). */
export const entityLayerSettings = (
  overrides: MediaOverrides | undefined, list: MediaList | undefined, { key, entityId, startId }: EntityMediaKey,
): LayerSettings | undefined =>
  settingsOver(
    withoutStaleVariants(overrides?.layers?.entities?.[key], list),
    withoutStaleVariants(entityId && startId ? overrides?.layers?.instances?.[entityId]?.[startId] : undefined, list),
  );

/** What a script set on a picture slot: the shown entry's id (an image or a Layered Image) and the Layer settings. */
export interface PictureOverride {
  id?: string;
  layers?: LayerSettings;
}

/** The entry ids play shows in place of the authored media, or undefined where no live override stands. */
export interface MediaOverrideReader {
  entity(entityId: string, field: keyof EntityMediaOverride): string | undefined;
  location(locationId: string, field: 'image' | 'ambience'): string | undefined;
  item(instanceId: string): string | undefined;
  music(): string | undefined;
  entityPicture(entityId: string): PictureOverride;
  locationPicture(locationId: string): PictureOverride;
  itemPicture(instanceId: string): PictureOverride;
}

const pictureOverride = (id: string | undefined, layers: LayerSettings | undefined): PictureOverride => ({ ...(id && { id }), ...(layers && { layers }) });

/** A reader of `overrides` against `list`, for play standing at `scene`. */
export function mediaOverrideReader(overrides: MediaOverrides | undefined, list: MediaList | undefined, scene: MediaOverrideScene): MediaOverrideReader {
  const keyOf = (entityId: string): EntityMediaKey => ({
    key: entityId && entityId === scene.personaId ? '' : entityId, entityId, startId: instanceAt(scene.genericStates, entityId, scene.locationId),
  });
  const location = (locationId: string, field: 'image' | 'ambience') => liveMediaId(list, overrides?.locations?.[locationId]?.[field], MEDIA_MEMBER_KIND[field]);
  const item = (instanceId: string) => liveMediaId(list, overrides?.items?.[instanceId], 'image');
  return {
    entity: (entityId, field) => entityOverrideId(overrides, list, keyOf(entityId), field),
    location,
    item,
    music: () => liveMediaId(list, overrides?.music, 'sound'),
    entityPicture: (entityId) => pictureOverride(entityOverrideId(overrides, list, keyOf(entityId), 'image'), entityLayerSettings(overrides, list, keyOf(entityId))),
    locationPicture: (locationId) => pictureOverride(location(locationId, 'image'), overrides?.layers?.locations?.[locationId]),
    itemPicture: (instanceId) => pictureOverride(item(instanceId), overrides?.layers?.items?.[instanceId]),
  };
}

/** The sound field play plays: the override as a link when one stands, else the authored value. */
export const soundWithOverride = <T>(authored: T, overrideId: string | undefined): T | MediaRef =>
  (overrideId ? { mediaId: overrideId } : authored);

/** The played persona entity's id, whose override sits under the empty key; undefined with no persona entity. */
export const personaEntityId = (ref: PersonaRef | undefined): string | undefined =>
  (ref && ref.source !== 'none' ? ref.entityId : undefined);

