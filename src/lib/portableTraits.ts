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

const ownIds = (entity: Entity): Set<string> =>
  new Set([...(entity.traits ?? []), ...(entity.traitGroups ?? [])].map((item) => item.id));

/** Every trait and group of the world and of its entities other than `except`. */
function targets(world: TraitWorld, except?: string) {
  const others = world.entities.filter((e) => e.id !== except);
  return {
    traits: [...world.traits, ...others.flatMap((e) => e.traits ?? [])],
    groups: [...world.traitGroups, ...others.flatMap((e) => e.traitGroups ?? [])],
    entities: others,
  };
}

const withRequires = (entity: Entity, map: (r: TraitRequirement) => TraitRequirement): Trait[] | undefined =>
  entity.traits?.map((t) => (t.requires ? { ...t, requires: t.requires.map(map) } : t));

/**
 * The entity's owned traits as they travel: a requirement into the entity keeps its id, one out of it also
 * stores its target's name, and a "playing as" on the entity itself reads {@link SELF_ENTITY}.
 */
export function portableOwnedTraits(entity: Entity, world?: TraitWorld): Portable {
  if (!entity.traits?.length && !entity.traitGroups?.length) return {};
  const inside = ownIds(entity);
  const pool = world ? targets(world, entity.id) : { traits: [], groups: [], entities: [] };
  const nameOf = (r: TraitRequirement): string | undefined => {
    const list: readonly { id: string; name: string }[] =
      r.kind === 'trait' ? pool.traits : r.kind === 'group' ? pool.groups : pool.entities;
    return list.find((item) => item.id === r.id)?.name ?? r.name;
  };
  const traits = withRequires(entity, (r) => {
    if (r.kind === 'playingAs' && r.id === entity.id) return { ...r, id: SELF_ENTITY, name: entity.name };
    if (r.kind !== 'playingAs' && inside.has(r.id)) return r;
    const name = nameOf(r);
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
  const personas = pool.entities.filter((e) => e.persona);
  const bind = (r: TraitRequirement): TraitRequirement => {
    if (r.kind === 'playingAs' && (r.id === SELF_ENTITY || r.id === entity.id)) return { ...r, id: entity.id };
    if (r.kind !== 'playingAs' && inside.has(r.id)) return r;
    const list: readonly { id: string; name: string }[] =
      r.kind === 'trait' ? pool.traits : r.kind === 'group' ? pool.groups : pool.entities;
    if (list.some((item) => item.id === r.id)) return r;
    const name = r.name?.trim();
    const named = name ? (r.kind === 'playingAs' ? personas : list).filter((item) => item.name.trim() === name) : [];
    return { ...r, id: named.length === 1 ? named[0].id : '' };
  };
  return { ...entity, traits: withRequires(entity, bind) };
}

/** A playthrough's library entities bound to its world: the library persona, then the added characters. */
export const libraryOwnersInPlay = (
  world: TraitWorld, persona: Entity | null | undefined, added: readonly Entity[],
): Entity[] => [...(persona ? [persona] : []), ...added].map((e) => bindOwnedTraits(e, world));

/**
 * A carried entity joining `world` as a new copy: its owned traits bound as {@link bindOwnedTraits} does,
 * under fresh ids when any of them collides with an id the world already holds.
 */
export function adoptOwnedTraits(entity: Entity, world: TraitWorld): Entity {
  const held = targets(world, entity.id);
  const taken = new Set([...held.traits, ...held.groups].map((item) => item.id));
  const collides = [...ownIds(entity)].some((id) => taken.has(id));
  return bindOwnedTraits(collides ? remintOwnedTraits(entity) : entity, world);
}
