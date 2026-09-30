// An entity's owned traits and links off-world: named on the way out, bound to a receiving world on the way in.

import type { Entity, Placeholder, PlaceholderGroup, RequirementBearer, Trait, TraitGroup, TraitLink, TraitRequirement } from '@/types';
import { linksInTreeOrder, originalOf } from './bearers';
import { remintOwnedTraits } from './ownedTraits';
import { worldBlueprints } from './placeholderBlueprints';
import { blueprintItemIds, groupsBelow } from './traitTree';

/** Off-world, a "playing as" or a named bearer on the entity itself names it by this id, since each copy has
 *  its own id. */
export const SELF_ENTITY = 'self';

/** The traits, groups, and entities a requirement or a link can point at in one world. */
export interface TraitWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  /** The world's blueprints, what a carried copy binds to. */
  blueprints?: readonly Placeholder[];
}

type Portable = Pick<Entity, 'traits' | 'traitGroups' | 'traitLinks'>;
type Named = { id: string; name: string };
type EntityBearer = Extract<RequirementBearer, { kind: 'entity' }>;
type Original = NonNullable<ReturnType<typeof originalOf>>;

/** A world's trait lists and its blueprints, when a record carries traits. A record with no placeholder folders has no blueprints. */
export const traitWorldOf = (data: {
  traits?: readonly Trait[]; traitGroups?: readonly TraitGroup[]; entities?: readonly Entity[];
  placeholders?: readonly Placeholder[]; placeholderGroups?: readonly PlaceholderGroup[];
}): TraitWorld | undefined => (data.traits ? {
  traits: data.traits, traitGroups: data.traitGroups ?? [], entities: data.entities ?? [],
  blueprints: worldBlueprints({ placeholders: [...data.placeholders ?? []], placeholderGroups: [...data.placeholderGroups ?? []] }),
} : undefined);

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

/** The one item carrying `name`, else null: no match and two matches both bind nothing. */
export function uniqueNamed<T extends Named>(list: readonly T[], name: string | undefined): T | null {
  const wanted = name?.trim();
  const named = wanted ? list.filter((item) => item.name.trim() === wanted) : [];
  return named.length === 1 ? named[0] : null;
}

const isSelf = (r: TraitRequirement, entityId: string) =>
  r.kind === 'playingAs' && (r.id === SELF_ENTITY || r.id === entityId);

const isSelfBearer = (b: EntityBearer, entityId: string) => b.id === SELF_ENTITY || b.id === entityId;

/** The requirement with its named bearer rewritten; the same requirement when it names none. */
const withBearer = (r: TraitRequirement, map: (b: EntityBearer) => RequirementBearer): TraitRequirement =>
  (r.kind !== 'playingAs' && r.bearer?.kind === 'entity' ? { ...r, bearer: map(r.bearer) } : r);

const withRequires = (entity: Entity, map: (r: TraitRequirement) => TraitRequirement): Trait[] | undefined =>
  entity.traits?.map((t) => (t.requires ? { ...t, requires: t.requires.map(map) } : t));

/** The entity with its links replaced; no links are stored as absent. */
function withLinks<T extends Portable>(entity: T, links: TraitLink[] | undefined): T {
  const { traitLinks: _l, ...rest } = entity;
  return (links?.length ? { ...rest, traitLinks: links } : rest) as T;
}

/** The trait ids a link's own data keys: its overrides. */
const keyedIds = (link: TraitLink): string[] => Object.keys(link.overrides ?? {});

/** The map with each key rewritten, a key that maps to null dropped; absent when nothing is left. */
function rekeyed<V>(map: Record<string, V> | undefined, key: (id: string) => string | null): Record<string, V> | undefined {
  const out = Object.fromEntries(Object.entries(map ?? {}).flatMap(([id, v]) => {
    const next = key(id);
    return next === null ? [] : [[next, v] as const];
  }));
  return Object.keys(out).length ? out : undefined;
}

/** The world original the link points at by id, when it is one of the `linkable` Blueprints items of the link's kind. */
function originalById(world: TraitWorld, linkable: ReadonlySet<string>, link: TraitLink): Original | null {
  const original = linkable.has(link.originalId) ? originalOf(world, link.originalId) : null;
  return original?.kind === link.kind ? original : null;
}

/** The one `linkable` Blueprints item of the link's kind that carries its stored name. */
function originalByName(world: TraitWorld, linkable: ReadonlySet<string>, link: TraitLink): Original | null {
  const list: readonly Named[] = (link.kind === 'trait' ? world.traits : world.traitGroups).filter((item) => linkable.has(item.id));
  const named = uniqueNamed(list, link.originalName);
  return named && originalOf(world, named.id);
}

/** What a link to the original brings: the original, the groups below it, and every trait in them. */
function brought(world: TraitWorld, original: Original): { ids: string[]; traits: readonly Trait[] } {
  if (original.kind === 'trait') return { ids: [original.item.id], traits: [original.item] };
  const groups = groupsBelow(world.traitGroups, original.item.id);
  const inside = new Set([original.item.id, ...groups.map((g) => g.id)]);
  const traits = world.traits.filter((t) => t.groupId != null && inside.has(t.groupId));
  return { ids: [...inside, ...traits.map((t) => t.id)], traits };
}

/** Each link naming its original, and each other trait its data keys, by the world's names. */
function portableLinks(links: readonly TraitLink[], world?: TraitWorld): TraitLink[] {
  return links.map((link) => {
    const found = world && originalOf(world, link.originalId);
    const original = found?.kind === link.kind ? found : null;
    const keyNames = Object.fromEntries(keyedIds(link).filter((id) => id !== link.originalId).flatMap((id) => {
      const name = world?.traits.find((t) => t.id === id)?.name ?? link.keyNames?.[id];
      return name ? [[id, name] as const] : [];
    }));
    const { keyNames: _stored, ...rest } = link;
    return { ...rest, originalName: original ? original.item.name : link.originalName, ...(Object.keys(keyNames).length ? { keyNames } : {}) };
  });
}

/**
 * The entity's links bound to `world`: each by its original's id, else by the one original of its kind
 * carrying its name, else dropped. A link that brings anything a link before it in tree order already brings
 * is dropped too, as the resolver keeps the first. Each data key follows the same rule inside what the bound
 * original brings.
 */
function bindLinks(entity: Entity, links: readonly TraitLink[], world: TraitWorld): TraitLink[] {
  const held = new Set<string>();
  const kept = new Map<string, TraitLink>();
  const linkable = blueprintItemIds(world);
  for (const link of linksInTreeOrder(entity, links)) {
    const bound = bindLink(link, world, linkable);
    if (!bound || bound.ids.some((id) => held.has(id))) continue;
    bound.ids.forEach((id) => held.add(id));
    kept.set(link.id, bound.link);
  }
  return links.flatMap((l) => kept.get(l.id) ?? []);
}

/** One link bound to `world`, with the ids it brings; null when no `linkable` original matches. */
function bindLink(link: TraitLink, world: TraitWorld, linkable: ReadonlySet<string>): { link: TraitLink; ids: string[] } | null {
  const original = originalById(world, linkable, link) ?? originalByName(world, linkable, link);
  if (!original) return null;
  const { ids, traits } = brought(world, original);
  const key = (id: string): string | null => {
    if (id === link.originalId) return original.item.id;
    if (traits.some((t) => t.id === id)) return id;
    return uniqueNamed(traits, link.keyNames?.[id])?.id ?? null;
  };
  const overrides = rekeyed(link.overrides, key);
  const { keyNames: _k, overrides: _o, ...rest } = link;
  return { ids, link: { ...rest, originalId: original.item.id, kind: original.kind, ...(overrides ? { overrides } : {}) } };
}

/** A library entity's links as the world it is opened in reads them: each that binds takes the world's ids,
 *  and one that does not stays as stored. Nothing is dropped, since the entity stays in the library. */
export function linksBoundTo(entity: Entity, world: TraitWorld): Entity {
  if (!entity.traitLinks?.length) return entity;
  const linkable = blueprintItemIds(world);
  return { ...entity, traitLinks: entity.traitLinks.map((l) => bindLink(l, world, linkable)?.link ?? l) };
}

/** A library entity's links as the library stores them, named from the world it is opened in. */
export const linksCarriedFrom = (entity: Entity, world: TraitWorld): Entity =>
  withLinks(entity, entity.traitLinks && portableLinks(entity.traitLinks, world));

/**
 * The entity's owned traits and links as they travel: a requirement into the entity keeps its id, one out of
 * it also stores its target's name, a named bearer stores its name, and the entity itself reads
 * {@link SELF_ENTITY}. Each link stores its original's name and the names of the traits its data keys.
 */
export function portableOwnedTraits(entity: Entity, world?: TraitWorld): Portable {
  if (!entity.traits?.length && !entity.traitGroups?.length && !entity.traitLinks?.length) return {};
  const inside = ownIds(entity);
  const pool = world ? targets(world, entity.id) : NO_TARGETS;
  const bearer = (b: EntityBearer): RequirementBearer => {
    if (isSelfBearer(b, entity.id)) return { kind: 'entity', id: SELF_ENTITY, name: entity.name };
    const name = world?.entities.find((e) => e.id === b.id)?.name ?? b.name;
    return name ? { ...b, name } : b;
  };
  const traits = withRequires(entity, (req) => {
    if (isSelf(req, entity.id)) return { ...req, id: SELF_ENTITY, name: entity.name };
    const r = withBearer(req, bearer);
    if (r.kind !== 'playingAs' && inside.has(r.id)) return r;
    const name = pool[r.kind].find((item) => item.id === r.id)?.name ?? r.name;
    return name ? { ...r, name } : r;
  });
  return {
    ...(traits?.length ? { traits } : {}),
    ...(entity.traitGroups?.length ? { traitGroups: entity.traitGroups } : {}),
    ...(entity.traitLinks?.length ? { traitLinks: portableLinks(entity.traitLinks, world) } : {}),
  };
}

/**
 * The entity's owned traits and links bound to `world`. A requirement into the entity stays; "playing as"
 * itself names the entity. An outward one keeps an id the world holds, else takes the one target carrying its
 * stored name. No match, or two, clears the id: the requirement stays unresolved and reads by its name. A
 * named bearer binds the same way among the world's entities. Links bind as {@link bindLinks} does.
 */
export function bindOwnedTraits(entity: Entity, world: TraitWorld): Entity {
  if (!entity.traits?.length && !entity.traitLinks?.length) return entity;
  const inside = ownIds(entity);
  const pool = targets(world, entity.id);
  const others = world.entities.filter((e) => e.id !== entity.id);
  const bearer = (b: EntityBearer): RequirementBearer => {
    if (isSelfBearer(b, entity.id)) return { ...b, id: entity.id };
    if (others.some((e) => e.id === b.id)) return b;
    return { ...b, id: uniqueNamed(others, b.name)?.id ?? '' };
  };
  const bind = (req: TraitRequirement): TraitRequirement => {
    if (isSelf(req, entity.id)) return { ...req, id: entity.id };
    const r = withBearer(req, bearer);
    if (r.kind !== 'playingAs' && inside.has(r.id)) return r;
    const list = pool[r.kind];
    if (list.some((item) => item.id === r.id)) return r;
    return { ...r, id: uniqueNamed(list, r.name)?.id ?? '' };
  };
  const traits = withRequires(entity, bind);
  const bound = traits ? { ...entity, traits } : entity;
  return entity.traitLinks ? withLinks(bound, bindLinks(entity, entity.traitLinks, world)) : bound;
}

/** A named bearer as two copies compare it: the entity itself as {@link SELF_ENTITY}, another by its name. */
const comparableBearer = (b: EntityBearer, entityId: string): RequirementBearer =>
  (isSelfBearer(b, entityId) ? { kind: 'entity', id: SELF_ENTITY } : b.name ? { kind: 'entity', id: '', name: b.name } : { kind: 'entity', id: b.id });

/** A link as two copies compare it: its original and data keys by name, since their ids are each world's own. */
type ComparableLink = Pick<TraitLink, 'id' | 'kind' | 'originalName' | 'groupId' | 'order' | 'overrides'>;

function comparableLink(link: TraitLink): ComparableLink {
  const key = (id: string) => (id === link.originalId ? '' : link.keyNames?.[id] ?? id);
  return {
    id: link.id, kind: link.kind, originalName: link.originalName, groupId: link.groupId ?? null, order: link.order,
    overrides: rekeyed(link.overrides, key),
  };
}

/**
 * The entity's owned traits and links as two copies compare them: a requirement out of it by the name it
 * stores (its id is each world's own), one into it by id, "playing as" itself as {@link SELF_ENTITY}, and a
 * named bearer by its name. Links compare as {@link comparableLink} reads them.
 */
export const comparableOwnedTraits = (entity: Entity): { traits?: Trait[]; traitLinks?: ComparableLink[] } => {
  const inside = ownIds(entity);
  const traits = withRequires(entity, (req) => {
    if (isSelf(req, entity.id)) return { kind: req.kind, id: SELF_ENTITY };
    const r = withBearer(req, (b) => comparableBearer(b, entity.id));
    const bearer = r.kind !== 'playingAs' && r.bearer ? { bearer: r.bearer } : {};
    if ((r.kind !== 'playingAs' && inside.has(r.id)) || !r.name) return { kind: r.kind, id: r.id, ...bearer } as TraitRequirement;
    return { kind: r.kind, id: '', name: r.name, ...bearer } as TraitRequirement;
  });
  return {
    ...(traits ? { traits } : {}),
    ...(entity.traitLinks?.length ? { traitLinks: entity.traitLinks.map(comparableLink) } : {}),
  };
};

/**
 * A carried entity joining `world` as a new copy: its owned traits and links bound as {@link bindOwnedTraits}
 * does, under fresh ids when any of them collides with an id the world already holds.
 */
export function adoptOwnedTraits(entity: Entity, world: TraitWorld): Entity {
  const held = targets(world, entity.id);
  const heldLinks = world.entities.filter((e) => e.id !== entity.id).flatMap((e) => e.traitLinks ?? []);
  const taken = new Set([...held.trait, ...held.group, ...heldLinks].map((item) => item.id));
  const collides = [...ownIds(entity), ...(entity.traitLinks ?? []).map((l) => l.id)].some((id) => taken.has(id));
  return bindOwnedTraits(collides ? remintOwnedTraits(entity) : entity, world);
}
