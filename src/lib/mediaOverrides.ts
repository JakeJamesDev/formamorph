// The Media Entries scripts set in play (Q2, Q49–Q53): their writes, how they lay over the save, and how play reads them.

import type { Base64Data, EntityMediaOverride, GenericStates, MediaEntry, MediaList, MediaOverrides, MediaRef, PersonaRef } from '@/types';

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

/** One script assignment: an entry id, or null to clear. */
export interface MediaWrite {
  owner: MediaOwner;
  field: MediaField;
  mediaId: string | null;
}

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

/** `overrides` with `write` laid on. */
function withMediaWrite(overrides: MediaOverrides, { owner, field, mediaId }: MediaWrite): MediaOverrides {
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

/** `id` when the list holds an entry of `kind` under it; an override naming a deleted entry reads as unset (Q19). */
export const liveMediaId = (list: MediaList | undefined, id: string | undefined, kind: MediaEntry['kind']): string | undefined =>
  (id && list?.[id]?.kind === kind ? id : undefined);

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

/** The entry ids play shows in place of the authored media, or undefined where no live override stands. */
export interface MediaOverrideReader {
  entity(entityId: string, field: keyof EntityMediaOverride): string | undefined;
  location(locationId: string, field: 'image' | 'ambience'): string | undefined;
  item(instanceId: string): string | undefined;
  music(): string | undefined;
}

/** A reader of `overrides` against `list`, for play standing at `scene`. */
export function mediaOverrideReader(overrides: MediaOverrides | undefined, list: MediaList | undefined, scene: MediaOverrideScene): MediaOverrideReader {
  return {
    entity: (entityId, field) => entityOverrideId(overrides, list, {
      key: entityId && entityId === scene.personaId ? '' : entityId, entityId, startId: instanceAt(scene.genericStates, entityId, scene.locationId),
    }, field),
    location: (locationId, field) => liveMediaId(list, overrides?.locations?.[locationId]?.[field], MEDIA_MEMBER_KIND[field]),
    item: (instanceId) => liveMediaId(list, overrides?.items?.[instanceId], 'image'),
    music: () => liveMediaId(list, overrides?.music, 'sound'),
  };
}

/** The sound field play plays: the override as a link when one stands, else the authored value. */
export const soundWithOverride = <T>(authored: T, overrideId: string | undefined): T | MediaRef =>
  (overrideId ? { mediaId: overrideId } : authored);

/** The played persona entity's id, whose override sits under the empty key; undefined with no persona entity. */
export const personaEntityId = (ref: PersonaRef | undefined): string | undefined =>
  (ref && ref.source !== 'none' ? ref.entityId : undefined);

/** One picture shown in play, with its author slot; an override's picture has slot -1. */
export interface ShownImage {
  slot: number;
  data: Base64Data;
}

/** The slot an override's picture takes among the shown ones. */
export const OVERRIDE_SLOT = -1;

/** `visible` with the override's picture first and any rule-visible copy of it dropped (Q51). */
export function withImageOverride<T extends ShownImage>(visible: T[], list: MediaList | undefined, id: string | undefined): (T | ShownImage)[] {
  const entry = id ? list?.[id] : undefined;
  if (!entry || entry.kind !== 'image') return visible;
  return [{ slot: OVERRIDE_SLOT, data: entry.data }, ...visible.filter((img) => img.data !== entry.data)];
}
