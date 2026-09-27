// An entity's owned traits off-world: named on the way out, bound to a receiving world on the way in.

import type { Entity, Trait, TraitGroup, TraitRequirement } from '@/types';
import { remintOwnedTraits } from './ownedTraits';

/** Off-world, a "playing as" on the entity itself names it by this id, since each copy has its own id. */
export const SELF_ENTITY = 'self';

/** The traits, groups, and entities a requirement can point at in one world. */
export interface TraitWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
}

type Portable = Pick<Entity, 'traits' | 'traitGroups'>;
type Named = { id: string; name: string };

/** A world's trait lists, when a record carries them. */
export const traitWorldOf = (data: { traits?: readonly Trait[]; traitGroups?: readonly TraitGroup[]; entities?: readonly Entity[] }): TraitWorld | undefined =>
  (data.traits ? { traits: data.traits, traitGroups: data.traitGroups ?? [], entities: data.entities ?? [] } : undefined);

const ownIds = (entity: Entity): Set<string> =>
  new Set([...(entity.traits ?? []), ...(entity.traitGroups ?? [])].map((item) => item.id));

/** Every trait and group of the world and of its entities other than `except`. */
function targets(world: TraitWorld, except?: string) {
  const others = world.entities.filter((e) => e.id !== except);
  const lists: Record<TraitRequirement['kind'], readonly Named[]> = {
    trait: [...world.traits, ...others.flatMap((e) => e.traits ?? [])],
    group: [...world.traitGroups, ...others.flatMap((e) => e.traitGroups ?? [])],
    // Only a persona can be played as.
    playingAs: others.filter((e) => e.persona),
  };
  return lists;
}

const NO_TARGETS: ReturnType<typeof targets> = { trait: [], group: [], playingAs: [] };

const isSelf = (r: TraitRequirement, entityId: string) =>
  r.kind === 'playingAs' && (r.id === SELF_ENTITY || r.id === entityId);

const withRequires = (entity: Entity, map: (r: TraitRequirement) => TraitRequirement): Trait[] | undefined =>
  entity.traits?.map((t) => (t.requires ? { ...t, requires: t.requires.map(map) } : t));

/**
 * The entity's owned traits as they travel: a requirement into the entity keeps its id, one out of it also
 * stores its target's name, and a "playing as" on the entity itself reads {@link SELF_ENTITY}.
 */
export function portableOwnedTraits(entity: Entity, world?: TraitWorld): Portable {
  if (!entity.traits?.length && !entity.traitGroups?.length) return {};
  const inside = ownIds(entity);
  const pool = world ? targets(world, entity.id) : NO_TARGETS;
  const traits = withRequires(entity, (r) => {
    if (isSelf(r, entity.id)) return { ...r, id: SELF_ENTITY, name: entity.name };
    if (r.kind !== 'playingAs' && inside.has(r.id)) return r;
    const name = pool[r.kind].find((item) => item.id === r.id)?.name ?? r.name;
    return name ? { ...r, name } : r;
  });
  return {
    ...(traits?.length ? { traits } : {}),
    ...(entity.traitGroups?.length ? { traitGroups: entity.traitGroups } : {}),
  };
}

/**
 * The entity's owned traits bound to `world`. A requirement into the entity stays; "playing as" itself names
 * the entity. An outward one keeps an id the world holds, else takes the one target carrying its stored name.
 * No match, or two, clears the id: the requirement stays unresolved and reads by its name.
 */
export function bindOwnedTraits(entity: Entity, world: TraitWorld): Entity {
  if (!entity.traits?.length) return entity;
  const inside = ownIds(entity);
  const pool = targets(world, entity.id);
  const bind = (r: TraitRequirement): TraitRequirement => {
    if (isSelf(r, entity.id)) return { ...r, id: entity.id };
    if (r.kind !== 'playingAs' && inside.has(r.id)) return r;
    const list = pool[r.kind];
    if (list.some((item) => item.id === r.id)) return r;
    const name = r.name?.trim();
    const named = name ? list.filter((item) => item.name.trim() === name) : [];
    return { ...r, id: named.length === 1 ? named[0].id : '' };
  };
  return { ...entity, traits: withRequires(entity, bind) };
}

/**
 * The entity's owned traits as two copies of it compare: a requirement out of it by the name it stores (its
 * id is each world's own), one into it by id, and "playing as" itself as {@link SELF_ENTITY}.
 */
export const comparableOwnedTraits = (entity: Entity): Trait[] | undefined => {
  const inside = ownIds(entity);
  return withRequires(entity, (r) => {
    if (isSelf(r, entity.id)) return { kind: r.kind, id: SELF_ENTITY };
    if ((r.kind !== 'playingAs' && inside.has(r.id)) || !r.name) return { kind: r.kind, id: r.id };
    return { kind: r.kind, id: '', name: r.name };
  });
};

/**
 * A carried entity joining `world` as a new copy: its owned traits bound as {@link bindOwnedTraits} does,
 * under fresh ids when any of them collides with an id the world already holds.
 */
export function adoptOwnedTraits(entity: Entity, world: TraitWorld): Entity {
  const held = targets(world, entity.id);
  const taken = new Set([...held.trait, ...held.group].map((item) => item.id));
  const collides = [...ownIds(entity)].some((id) => taken.has(id));
  return bindOwnedTraits(collides ? remintOwnedTraits(entity) : entity, world);
}
