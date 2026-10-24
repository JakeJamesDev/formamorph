// An entity's owned traits and links off-world: named on the way out, bound to a receiving world on the way in.

import type {
  Entity, GalleryImage, Placeholder, PlaceholderGroup, RequirementOwner, Stat, StatGroup, StatRequirement, Trait, TraitGroup, TraitLink, TraitRequirement,
} from '@/types';
import { canBePlayer, linksInTreeOrder, originalOf } from './owners';
import { resolvedEntityStats } from './statLinks';
import { uniqueNamed, type Named } from './carriedBinding';
import { bindLinks, comparableLink, linksBound, portableLinks, type ComparableLink, type LinkLists } from './portableLinks';
import { bindOwnedStats, type StatWorld } from './portableStats';
import { remintOwnedTraits } from './ownedTraits';
import { worldBlueprints } from './placeholderBlueprints';
import { blueprintItemIds, groupsBelow } from './traitTree';
import { mapConditions, notFlag } from './requirementRows';
import { daypartSet } from './gameClock';
import { hasImageRules, mapImageRules, withImageRules } from './entityImages';
import { withoutGlobalOwner } from './version';

/** Off-world, a "playing as" or a named owner on the entity itself names it by this id, since each copy has
 *  its own id. */
export const SELF_ENTITY = 'self';

/** The traits, groups, and entities a requirement or a link can point at in one world, and its stats when a
 *  carried entity's stat Links bind to them. */
export interface TraitWorld extends StatWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  /** The world's blueprints, what a carried copy binds to. */
  blueprints?: readonly Placeholder[];
}

type Portable = Pick<Entity, 'traits' | 'traitGroups' | 'traitLinks'>;
type EntityOwner = Extract<RequirementOwner, { kind: 'entity' }>;

/** A world's trait lists, its stats and its blueprints, when a record carries traits. A record with no placeholder folders has no blueprints. */
export const traitWorldOf = (data: {
  traits?: readonly Trait[]; traitGroups?: readonly TraitGroup[]; entities?: readonly Entity[];
  placeholders?: readonly Placeholder[]; placeholderGroups?: readonly PlaceholderGroup[];
  stats?: readonly Stat[]; statGroups?: readonly StatGroup[];
}): TraitWorld | undefined => (data.traits ? {
  traits: data.traits, traitGroups: data.traitGroups ?? [], entities: data.entities ?? [],
  ...(data.stats ? { stats: data.stats, statGroups: data.statGroups ?? [] } : {}),
  blueprints: worldBlueprints({ placeholders: [...data.placeholders ?? []], placeholderGroups: [...data.placeholderGroups ?? []] }),
} : undefined);

const ownIds = (entity: Entity): Set<string> =>
  new Set([...(entity.traits ?? []), ...(entity.traitGroups ?? [])].map((item) => item.id));

/** Whether a requirement points inside the entity: at one of its own traits, groups or stats. */
const pointsInside = (r: TraitRequirement, entity: Entity, inside: ReadonlySet<string>): boolean =>
  (r.kind === 'stat' ? !!entity.stats?.some((s) => s.id === r.id) : r.kind !== 'playingAs' && r.kind !== 'time' && inside.has(r.id));

/** Every trait, group and stat of the world and of its entities other than `except`. */
function targets(world: TraitWorld, except?: string) {
  const others = world.entities.filter((e) => e.id !== except);
  const lists: Record<TraitRequirement['kind'], readonly Named[]> = {
    trait: [...world.traits, ...others.flatMap((e) => e.traits ?? [])],
    group: [...world.traitGroups, ...others.flatMap((e) => e.traitGroups ?? [])],
    // Only a persona can be played as.
    playingAs: others.filter((e) => e.persona),
    stat: [...world.stats ?? [], ...others.flatMap((e) => e.stats ?? [])],
    time: [],
  };
  return lists;
}

const NO_TARGETS: ReturnType<typeof targets> = { trait: [], group: [], playingAs: [], stat: [], time: [] };

const isSelf = (r: TraitRequirement, entityId: string): r is Extract<TraitRequirement, { kind: 'playingAs' }> =>
  r.kind === 'playingAs' && (r.id === SELF_ENTITY || r.id === entityId);

const isSelfOwner = (b: EntityOwner, entityId: string) => b.id === SELF_ENTITY || b.id === entityId;

/** The requirement with its named owner rewritten; the same requirement when it names none. */
const withOwner = (r: TraitRequirement, map: (b: EntityOwner) => RequirementOwner): TraitRequirement =>
  (r.kind !== 'playingAs' && r.kind !== 'time' && r.owner?.kind === 'entity' ? { ...r, owner: map(r.owner) } : r);

const withRequires = (entity: Entity, map: (r: TraitRequirement) => TraitRequirement): Trait[] | undefined =>
  entity.traits?.map((t) => (t.requires ? { ...t, requires: mapConditions(t.requires, map) } : t));

/** The entity with its links replaced; no links are stored as absent. */
function withLinks<T extends Portable>(entity: T, links: TraitLink[] | undefined): T {
  const { traitLinks: _l, ...rest } = entity;
  return (links?.length ? { ...rest, traitLinks: links } : rest) as T;
}

/** What a link to the original brings: the original, the groups below it, and every trait in them. */
function brought(world: TraitWorld, original: Named, kind: TraitLink['kind']): { ids: string[]; leaves: readonly Trait[] } {
  if (kind === 'trait') return { ids: [original.id], leaves: world.traits.filter((t) => t.id === original.id) };
  const groups = groupsBelow(world.traitGroups, original.id);
  const inside = new Set([original.id, ...groups.map((g) => g.id)]);
  const traits = world.traits.filter((t) => t.groupId != null && inside.has(t.groupId));
  return { ids: [...inside, ...traits.map((t) => t.id)], leaves: traits };
}

/** The world's trait lists as its links read them. A link binds only to a Blueprints item. */
function traitLists(world: TraitWorld): LinkLists<TraitLink> {
  let linkable: Set<string> | undefined;
  const listOf = (kind: TraitLink['kind']): readonly Named[] => (kind === 'trait' ? world.traits : world.traitGroups);
  return {
    originalNamed: (link) => listOf(link.kind).find((item) => item.id === link.originalId && originalOf(world, item.id)),
    originals: (kind) => {
      const ids = (linkable ??= blueprintItemIds(world));
      return listOf(kind).filter((item) => ids.has(item.id));
    },
    leaves: world.traits,
    brought: (original, kind) => brought(world, original, kind),
  };
}

/** A library entity's links as the world it is opened in reads them: each that binds takes the world's ids,
 *  and one that does not stays as stored. Nothing is dropped, since the entity stays in the library. */
export function linksBoundTo(entity: Entity, world: TraitWorld): Entity {
  if (!entity.traitLinks?.length) return entity;
  return { ...entity, traitLinks: linksBound(entity.traitLinks, traitLists(world)) };
}

/** A library entity's links as the library stores them, named from the world it is opened in. */
export const linksCarriedFrom = (entity: Entity, world: TraitWorld): Entity =>
  withLinks(entity, entity.traitLinks && portableLinks(entity.traitLinks, traitLists(world)));

/** One of the entity's Conditions as it travels: see {@link portableOwnedTraits}. */
function portableRequirement(entity: Entity, world?: TraitWorld): (req: TraitRequirement) => TraitRequirement {
  const inside = ownIds(entity);
  const pool = world ? targets(world, entity.id) : NO_TARGETS;
  const owner = (b: EntityOwner): RequirementOwner => {
    if (isSelfOwner(b, entity.id)) return { kind: 'entity', id: SELF_ENTITY, name: entity.name };
    const name = world?.entities.find((e) => e.id === b.id)?.name ?? b.name;
    return name ? { ...b, name } : b;
  };
  return (req) => {
    if (isSelf(req, entity.id)) return { ...req, id: SELF_ENTITY, name: entity.name };
    const r = withOwner(req, owner);
    if (r.kind === 'time' || pointsInside(r, entity, inside)) return r;
    const name = pool[r.kind].find((item) => item.id === r.id)?.name ?? r.name;
    return name ? { ...r, name } : r;
  };
}

/** The entity's gallery as it travels: each Visibility rule's Conditions named as an owned trait's are. */
export const portableImages = (entity: Entity, world?: TraitWorld): GalleryImage[] =>
  mapImageRules(entity, portableRequirement(entity, world));

/**
 * The entity's owned traits and links as they travel: a requirement into the entity keeps its id, one out of
 * it also stores its target's name, a named owner stores its name, and the entity itself reads
 * {@link SELF_ENTITY}. Each link stores its original's name and the names of the traits its data keys.
 */
export function portableOwnedTraits(entity: Entity, world?: TraitWorld): Portable {
  if (!entity.traits?.length && !entity.traitGroups?.length && !entity.traitLinks?.length) return {};
  const traits = withRequires(entity, portableRequirement(entity, world));
  return {
    ...(traits?.length ? { traits } : {}),
    ...(entity.traitGroups?.length ? { traitGroups: entity.traitGroups } : {}),
    ...(entity.traitLinks?.length ? { traitLinks: portableLinks(entity.traitLinks, world && traitLists(world)) } : {}),
  };
}

/** One of the entity's Conditions bound to `world`: see {@link bindOwnedTraits}. */
function ruleBinder(entity: Entity, world: TraitWorld): (req: TraitRequirement) => TraitRequirement {
  const inside = ownIds(entity);
  const pool = targets(world, entity.id);
  const others = world.entities.filter((e) => e.id !== entity.id);
  const owner = (b: EntityOwner): RequirementOwner => {
    if (isSelfOwner(b, entity.id)) return { ...b, id: entity.id };
    if (others.some((e) => e.id === b.id)) return b;
    return { ...b, id: uniqueNamed(others, b.name)?.id ?? '' };
  };
  const statWorld = world.stats && { stats: world.stats, statGroups: world.statGroups ?? [] };
  // A stat binds among its owner's stats (Q25). You binds among every playable entity's stats, never global ones (Q33).
  const statsOf = (r: StatRequirement, at: NonNullable<typeof statWorld>): readonly Named[] => {
    if (!r.owner) return at.stats;
    if (r.owner.kind === 'you') return [...others, entity].filter(canBePlayer).flatMap((e) => resolvedEntityStats(at, e));
    const id = r.owner.id;
    const held = id === entity.id ? entity : others.find((e) => e.id === id);
    return held ? resolvedEntityStats(at, held) : [];
  };
  // A Condition that names a global item reads global scope, so the owner it stored goes (Q19).
  const withoutGlobalOwners = withoutGlobalOwner<TraitRequirement>({ ...world, entities: [...others, entity] });
  const bindId = (req: TraitRequirement): TraitRequirement => {
    if (isSelf(req, entity.id)) return { ...req, id: entity.id };
    const r = withOwner(req, owner);
    // A world record that carries no stats has none to bind a stat Condition to.
    if (r.kind === 'time' || pointsInside(r, entity, inside) || (r.kind === 'stat' && !statWorld)) return r;
    const list = r.kind === 'stat' ? statsOf(r, statWorld!) : pool[r.kind];
    if (list.some((item) => item.id === r.id)) return r;
    return { ...r, id: uniqueNamed(list, r.name)?.id ?? '' };
  };
  return (req) => withoutGlobalOwners(bindId(req));
}

/** The entity with each Condition of its owned traits, image Visibility rules and link overrides bound to
 *  `world`, and its links left as they are. A copy and its library source compare through this, so both read
 *  the owners a world drops (Q19). */
export function bindOwnedRules(entity: Entity, world: TraitWorld): Entity {
  if (!entity.traits?.length && !entity.traitLinks?.length && !hasImageRules(entity)) return entity;
  const bind = ruleBinder(entity, world);
  const traits = withRequires(entity, bind);
  const bound = withImageRules(traits ? { ...entity, traits } : entity, bind);
  return entity.traitLinks ? { ...bound, traitLinks: entity.traitLinks.map((l) => linkWithRules(l, bind)) } : bound;
}

/**
 * The entity's owned traits, links and image Visibility rules bound to `world`. A requirement into the entity
 * stays; "playing as" itself names the entity. An outward one keeps an id the world holds, else takes the one
 * target carrying its stored name. No match, or two, clears the id: the requirement stays unresolved and reads
 * by its name. A named owner binds the same way among the world's entities. Links bind as {@link bindLinks} does.
 */
export function bindOwnedTraits(entity: Entity, world: TraitWorld): Entity {
  if (!entity.traits?.length && !entity.traitLinks?.length && !hasImageRules(entity)) return entity;
  const bind = ruleBinder(entity, world);
  const traits = withRequires(entity, bind);
  const bound = withImageRules(traits ? { ...entity, traits } : entity, bind);
  const links = entity.traitLinks && bindLinks(entity.traitLinks, linksInTreeOrder(entity), traitLists(world)).map((l) => linkWithRules(l, bind));
  return entity.traitLinks ? withLinks(bound, links) : bound;
}

/** The link with `map` over the Conditions of both sides of each `requires` override. */
function linkWithRules(link: TraitLink, map: (r: TraitRequirement) => TraitRequirement): TraitLink {
  if (!link.overrides) return link;
  const overrides = Object.fromEntries(Object.entries(link.overrides).map(([id, fields]) => {
    const req = fields?.requires;
    const requires = req && { value: mapConditions(req.value, map), blueprint: mapConditions(req.blueprint, map) };
    return [id, requires ? { ...fields, requires } : fields];
  }));
  return { ...link, overrides };
}

/** A named owner as two copies compare it: the entity itself as {@link SELF_ENTITY}, another by its name. */
const comparableOwner = (b: EntityOwner, entityId: string): RequirementOwner =>
  (isSelfOwner(b, entityId) ? { kind: 'entity', id: SELF_ENTITY } : b.name ? { kind: 'entity', id: '', name: b.name } : { kind: 'entity', id: b.id });

/**
 * The entity's owned traits, links and image Visibility rules as two copies compare them: a requirement out
 * of it by the name it stores (its id is each world's own), one into it by id, "playing as" itself as
 * {@link SELF_ENTITY}, and a named owner by its name. Links compare as {@link comparableLink} reads them.
 */
export const comparableOwnedTraits = (entity: Entity): { traits?: Trait[]; traitLinks?: ComparableLink<TraitLink>[]; images?: GalleryImage[] } => {
  const inside = ownIds(entity);
  const comparable = (req: TraitRequirement): TraitRequirement => {
    if (req.kind === 'time') return { kind: 'time', dayparts: daypartSet(req.dayparts) };
    const not = notFlag(req.not);
    if (isSelf(req, entity.id)) return { kind: req.kind, id: SELF_ENTITY, ...not };
    const r = withOwner(req, (b) => comparableOwner(b, entity.id));
    const owner = r.kind !== 'playingAs' && r.owner ? { owner: r.owner } : {};
    const comparison = r.kind === 'stat' ? { operator: r.operator, value: r.value, unit: r.unit } : {};
    if (pointsInside(r, entity, inside) || !r.name) return { kind: r.kind, id: r.id, ...owner, ...comparison, ...not } as TraitRequirement;
    return { kind: r.kind, id: '', name: r.name, ...owner, ...comparison, ...not } as TraitRequirement;
  };
  const traits = withRequires(entity, comparable);
  return {
    ...(traits ? { traits } : {}),
    ...(hasImageRules(entity) ? { images: mapImageRules(entity, comparable) } : {}),
    ...(entity.traitLinks?.length ? { traitLinks: entity.traitLinks.map(comparableLink) } : {}),
  };
};

/**
 * A carried entity joining `world` as a new copy: its owned traits and links bound as {@link bindOwnedTraits}
 * does, under fresh ids when any of them collides with an id the world already holds, and its stat Links bound
 * as {@link bindOwnedStats} does.
 */
export function adoptOwnedTraits(entity: Entity, world: TraitWorld): Entity {
  const held = targets(world, entity.id);
  const heldLinks = world.entities.filter((e) => e.id !== entity.id).flatMap((e) => e.traitLinks ?? []);
  const taken = new Set([...held.trait, ...held.group, ...heldLinks].map((item) => item.id));
  const collides = [...ownIds(entity), ...(entity.traitLinks ?? []).map((l) => l.id)].some((id) => taken.has(id));
  return bindOwnedStats(bindOwnedTraits(collides ? remintOwnedTraits(entity) : entity, world), world);
}
