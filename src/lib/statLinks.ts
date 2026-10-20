// Stat Blueprints and Links: the world's Blueprints stat group, an entity's links to the stats and groups in it,
// and the stats each entity owns once its links are read through their originals. This module is the one place
// that expands a stat link, for the editor and for play.

import type { Entity, Script, Stat, StatGroup, StatLink, StatLinkFields, StatLinkOverrides } from '@/types';
import { effectiveRecord, sameValue, withOverride, withoutOverride, type EffectiveRecord } from './blueprints';
import { blueprintsGroup, blueprintsSubtreeIds, groupsBelow } from './blueprintGroups';
import { removeStatGroup, statRootCount, statsInTreeOrder } from './statGroupTree';
import type { TreeLeaf } from './groupTree';
import { treeChoices, type OwnerChoice } from './ownerChoices';
import { ownerLinksInTreeOrder, withEntityLists } from './ownerTree';
import type { HeldReason } from './heldReasons';
import { randomUUID } from './uuid';
import { newStat } from './blankWorld';
import { regenUnitOf } from './regenUnits';
import { statStartValue } from './statDescriptorGeometry';

/** The tree place a link or leaf carries: its group and, when set, its order. */
export const placeOf = (item: { groupId?: string | null; order?: number }): { groupId: string | null; order?: number } =>
  ({ groupId: item.groupId ?? null, ...(item.order !== undefined ? { order: item.order } : {}) });

/** What stat link resolution reads from a world. */
export interface StatLinkWorld {
  stats: readonly Stat[];
  statGroups: readonly StatGroup[];
}

/** A world with no stats: no Blueprint to link or bind. */
export const NO_STAT_WORLD: StatLinkWorld = { stats: [], statGroups: [] };

// ---- The Blueprints group ----

/** The world stats inside Blueprints. */
export function statBlueprintIds(world: StatLinkWorld): Set<string> {
  const inBlueprints = blueprintsSubtreeIds(world.statGroups);
  return new Set(world.stats.filter((s) => s.groupId != null && inBlueprints.has(s.groupId)).map((s) => s.id));
}

/** The Blueprint stat with this id, or undefined when the id names no stat inside Blueprints. */
export function statBlueprint(world: StatLinkWorld, id: string): Stat | undefined {
  return statBlueprintIds(world).has(id) ? world.stats.find((s) => s.id === id) : undefined;
}

/** The stats of the Blueprint group `stat` sits in, itself included: what its code's `owner.stats` holds. A
 *  Blueprint stat directly under Blueprints belongs to no group of its own, so it holds itself alone. */
export function blueprintGroupStats(world: StatLinkWorld, stat: Stat): Stat[] {
  const group = world.statGroups.find((g) => g.id === stat.groupId);
  if (!group || group.system === 'blueprints') return [stat];
  return world.stats.filter((s) => s.groupId === group.id);
}

/** What a link may point at: a stat or a stat group inside Blueprints. Blueprints itself is not an original. */
export type StatOriginal = { kind: 'stat'; item: Stat } | { kind: 'group'; item: StatGroup };

/** The original with this id, or null when the id names nothing inside Blueprints. */
export function statOriginalOf(world: StatLinkWorld, id: string): StatOriginal | null {
  const inside = blueprintsSubtreeIds(world.statGroups);
  const stat = world.stats.find((s) => s.id === id);
  if (stat) return stat.groupId != null && inside.has(stat.groupId) ? { kind: 'stat', item: stat } : null;
  const group = world.statGroups.find((g) => g.id === id);
  return group && group.system !== 'blueprints' && inside.has(group.id) ? { kind: 'group', item: group } : null;
}

/** A Blueprint group's live subtree: the groups below it and every stat in it or below it. */
function statSubtree(world: StatLinkWorld, group: StatGroup): { groups: StatGroup[]; stats: Stat[] } {
  const groups = groupsBelow(world.statGroups, group.id);
  const ids = new Set([group.id, ...groups.map((g) => g.id)]);
  return { groups, stats: world.stats.filter((s) => s.groupId != null && ids.has(s.groupId)) };
}

/** The world ids a link to `originalId` brings: the original and, for a group, its live subtree. */
export function statBroughtIds(world: StatLinkWorld, originalId: string): string[] {
  const original = statOriginalOf(world, originalId);
  if (!original) return [];
  if (original.kind === 'stat') return [originalId];
  const { groups, stats } = statSubtree(world, original.item);
  return [originalId, ...groups.map((g) => g.id), ...stats.map((s) => s.id)];
}

/** The Blueprint stats and the groups that hold one, as a drill-down flyout's rows in tree order. A row in the
 *  Blueprints group itself sits at the top level. */
export function statBlueprintChoices(world: StatLinkWorld): OwnerChoice[] {
  const bp = blueprintsGroup(world.statGroups);
  if (!bp) return [];
  const inside = blueprintsSubtreeIds(world.statGroups);
  const up = (id: string | null | undefined) => (id === bp.id ? null : id ?? null);
  const groups = world.statGroups.filter((g) => g.id !== bp.id && inside.has(g.id)).map((g) => ({ ...g, parentId: up(g.parentId) }));
  const stats = world.stats.filter((s) => s.groupId != null && inside.has(s.groupId)).map((s) => ({ ...s, groupId: up(s.groupId) }));
  return treeChoices(groups, stats);
}

/** The world's stats without Blueprints: the global stats. The same list when it holds no Blueprint. */
export function globalStatsOf<T extends Stat>(stats: T[], groups: readonly StatGroup[]): T[] {
  const inBlueprints = blueprintsSubtreeIds(groups);
  if (!inBlueprints.size || !stats.some((s) => s.groupId != null && inBlueprints.has(s.groupId))) return stats;
  return stats.filter((s) => s.groupId == null || !inBlueprints.has(s.groupId));
}

// ---- One link ----

/** The overridable fields as the original carries them, absent ones read as off or empty. The Base Value is
 *  the original's start value (Q8). */
export const statLinkFieldsOf = (stat: Stat): StatLinkFields => ({
  type: stat.type,
  description: stat.description ?? '',
  min: stat.min,
  max: stat.max,
  value: statStartValue(stat),
  regen: stat.regen ?? 0,
  regenUnit: regenUnitOf(stat),
  descriptors: stat.descriptors ?? [],
  thresholdUnit: stat.thresholdUnit ?? 'raw',
  scripts: stat.scripts ?? [],
  morphBindings: stat.morphBindings ?? [],
  enabled: stat.enabled !== false,
  hidden: stat.hidden === true,
  noIncrease: !!stat.noIncrease,
  noIncreaseMax: !!stat.noIncreaseMax,
  noDecrease: !!stat.noDecrease,
  noDecreaseMax: !!stat.noDecreaseMax,
});

/** The original's overridable fields as `link` reads them, with what it overrides and what went stale. */
export const statLinkState = (original: Stat, link: StatLink): EffectiveRecord<StatLinkFields> =>
  effectiveRecord(statLinkFieldsOf(original), link.overrides?.[original.id]);

/** The original stat as `link` reads it, at `at`: the link's own place by default. The id and name stay the
 *  original's, so in play each owner holds its own value under the original's id. */
export function linkedStat(original: Stat, link: StatLink, at: { groupId: string | null; order?: number } = placeOf(link)): Stat {
  const { groupId: _g, order: _o, ...base } = original;
  const { record, overridden } = statLinkState(original, link);
  if (!overridden.length && original.starting === undefined) return { ...base, ...at };
  const fields = Object.fromEntries(overridden.map((field) => [field, record[field]]));
  // The copy's delta baseline is its own opening value, so the Original's `starting` stays behind.
  const { starting: _s, ...rest } = base;
  return { ...rest, ...(original.starting !== undefined ? { value: record.value } : {}), ...fields, ...at };
}

/** The link with its map for one original stat replaced; an emptied map drops the key, then the whole map. */
function withStatOverrides(link: StatLink, statId: string, next: StatLinkOverrides | undefined): StatLink {
  const { [statId]: _old, ...others } = link.overrides ?? {};
  const map = next && Object.keys(next).length ? { ...others, [statId]: next } : others;
  const { overrides: _prev, ...rest } = link;
  return Object.keys(map).length ? { ...rest, overrides: map } : rest;
}

/** The link overriding each field where `edited` differs from what the link reads now on `original`; the same
 *  link when nothing differs. An editor writes the whole stat, so this keeps untouched fields live. The name
 *  never overrides. */
export function setStatLinkEdits(link: StatLink, original: Stat, edited: Stat): StatLink {
  const current = statLinkState(original, link).record;
  const next = statLinkFieldsOf(edited);
  const snapshot = statLinkFieldsOf(original);
  const before = link.overrides?.[original.id];
  let overrides = before;
  for (const field of Object.keys(next) as (keyof StatLinkFields)[]) {
    if (!sameValue(next[field], current[field])) overrides = withOverride(overrides, field, next[field], snapshot[field]);
  }
  return overrides === before ? link : withStatOverrides(link, original.id, overrides);
}

/**
 * The link with its scripts override set to `scripts`, as a rename rewrites both sides. The snapshot of the
 * Blueprint's scripts moves from `before` to `after` only where it read `before`, so a stale override stays stale.
 */
export function setStatLinkScripts(
  link: StatLink, statId: string, scripts: Script[], before: readonly Script[], after: Script[],
): StatLink {
  const current = link.overrides?.[statId]?.scripts;
  if (!current) return link;
  const blueprint = sameValue(current.blueprint, before) ? after : current.blueprint;
  return withStatOverrides(link, statId, withOverride(link.overrides?.[statId], 'scripts', scripts, blueprint));
}

/** Fields one Reset clears together: Regen's number and the unit it shows in are one field on screen. */
const RESET_WITH: Partial<Record<keyof StatLinkFields, (keyof StatLinkFields)[]>> = { regen: ['regenUnit'] };

/** The link reading `field` on one original stat live again. The same link when it did not override it. */
export function resetStatLinkField(link: StatLink, statId: string, field: keyof StatLinkFields): StatLink {
  const current = link.overrides?.[statId];
  if (!current) return link;
  let next: StatLinkOverrides | undefined = current;
  for (const f of [field, ...(RESET_WITH[field] ?? [])]) next = withoutOverride(next, f);
  return next === current ? link : withStatOverrides(link, statId, next);
}

/** The link reading its original live everywhere: Reset to Blueprint. */
export function resetStatLinkOverrides(link: StatLink): StatLink {
  const { overrides: _drop, ...rest } = link;
  return rest;
}

// ---- An entity's links ----

/** The entity with its stat links replaced. No links are stored as absent. */
export const withStatLinks = (entity: Entity, links: StatLink[]): Entity => withEntityLists(entity, { statLinks: links });

const withStatLink = (entity: Entity, linkId: string, edit: (link: StatLink) => StatLink): Entity =>
  withStatLinks(entity, (entity.statLinks ?? []).map((l) => (l.id === linkId ? edit(l) : l)));

/** Each link as a tree leaf, so it sorts and drops among the entity's own stats. */
export const statLinkLeaves = (entity: Entity): TreeLeaf[] =>
  (entity.statLinks ?? []).map((l) => ({ id: l.id, name: l.originalName, ...placeOf(l) }));

/** How many stats, links and groups sit at the entity's top level: the `order` a new root item takes. */
export const entityStatRootCount = (entity: Entity): number =>
  statRootCount(entity.statGroups, [...(entity.stats ?? []), ...statLinkLeaves(entity)]);

/** Whether the entity already links the original. */
export const linksStat = (entity: Entity, originalId: string): boolean =>
  (entity.statLinks ?? []).some((l) => l.originalId === originalId);

/** Why the entity's tree already holds the original, or anything a link to it would bring: one of its own
 *  stats, or a stat or group one of its links brings. Null when it holds none of it. */
export function statHeldReason(world: StatLinkWorld, entity: Entity, originalId: string): HeldReason | null {
  const name = statOriginalOf(world, originalId)?.item.name ?? '';
  const direct = (entity.statLinks ?? []).find((l) => l.originalId === originalId);
  if (direct) return { kind: 'links', name: name || direct.originalName };
  const brought = new Set(statBroughtIds(world, originalId));
  const own = (entity.stats ?? []).find((s) => brought.has(s.id));
  if (own) return { kind: 'owns', name: own.name };
  for (const link of entity.statLinks ?? []) {
    const linked = statBroughtIds(world, link.originalId);
    if (!linked.some((id) => brought.has(id))) continue;
    return linked.includes(originalId)
      ? { kind: 'group', name, group: link.originalName }
      : { kind: 'inside', name: link.originalName, group: name };
  }
  return null;
}

/** Whether the entity's tree already holds the original, or anything a link to it would bring. */
export const holdsStatOriginal = (world: StatLinkWorld, entity: Entity, originalId: string): boolean =>
  statHeldReason(world, entity, originalId) !== null;

/** Link a Blueprint stat or group at the end of the entity's top level. Null when the id is not an original or
 *  the entity already holds it. */
export function addStatLink(world: StatLinkWorld, entity: Entity, originalId: string, id: string): Entity | null {
  const original = statOriginalOf(world, originalId);
  if (!original || holdsStatOriginal(world, entity, originalId)) return null;
  const link: StatLink = {
    id, originalId, kind: original.kind, originalName: original.item.name, groupId: null, order: entityStatRootCount(entity),
  };
  return withStatLinks(entity, [...(entity.statLinks ?? []), link]);
}

/** Remove one link. The original is untouched. */
export const removeStatLink = (entity: Entity, linkId: string): Entity =>
  withStatLinks(entity, (entity.statLinks ?? []).filter((l) => l.id !== linkId));

/** Write an editor's edit of one stat a link brings as the link's overrides on the fields it changed. The entity
 *  as it is when the stat is gone. */
export function editStatLink(world: StatLinkWorld, entity: Entity, linkId: string, statId: string, edited: Stat): Entity {
  const original = world.stats.find((s) => s.id === statId);
  return original ? withStatLink(entity, linkId, (l) => setStatLinkEdits(l, original, edited)) : entity;
}

/** Read one field of one original stat a link brings live again. */
export const resetStatLinkFieldOn = (entity: Entity, linkId: string, statId: string, field: keyof StatLinkFields): Entity =>
  withStatLink(entity, linkId, (l) => resetStatLinkField(l, statId, field));

/** Read one stat a link brings live again. */
export const resetStatLinkStatOn = (entity: Entity, linkId: string, statId: string): Entity =>
  withStatLink(entity, linkId, (l) => withStatOverrides(l, statId, undefined));

/** Read the whole original live again: Reset to Blueprint. */
export const resetStatLinkOn = (entity: Entity, linkId: string): Entity => withStatLink(entity, linkId, resetStatLinkOverrides);

/** The entity with its own stats, its links and its stat groups replaced from one tree's leaves: a leaf that is
 *  a link writes that link's place, any other is an own stat. */
export function withEntityStatTree<L extends Omit<TreeLeaf, 'name'>>(
  entity: Entity, leaves: readonly L[], groups: StatGroup[], toStat: (leaf: L) => Stat | undefined,
): Entity {
  const links = new Map((entity.statLinks ?? []).map((l) => [l.id, l]));
  const placed = new Map(leaves.filter((leaf) => links.has(leaf.id)).map((leaf) => [leaf.id, leaf]));
  const stats = leaves.filter((leaf) => !links.has(leaf.id)).flatMap((leaf) => toStat(leaf) ?? []);
  const nextLinks = [...links.values()].map((l) => {
    const leaf = placed.get(l.id);
    return leaf ? { ...l, ...placeOf(leaf) } : l;
  });
  return withEntityLists(entity, { statLinks: nextLinks, stats, statGroups: groups });
}

/** Delete one of the entity's stat groups; its stats, links and subgroups move up to its parent. */
export function removeEntityStatGroup(entity: Entity, groupId: string): Entity {
  const own = new Map((entity.stats ?? []).map((s) => [s.id, s]));
  const leaves = [...(entity.stats ?? []), ...statLinkLeaves(entity)];
  const next = removeStatGroup(entity.statGroups ?? [], leaves, groupId);
  if (next.groups === entity.statGroups) return entity;
  return withEntityStatTree(entity, next.stats, next.groups, (leaf) => {
    const stat = own.get(leaf.id);
    return stat && { ...stat, ...placeOf(leaf) };
  });
}

/**
 * Replace a link with the entity's own copy of what it brings, in the link's place. Each stat keeps the
 * original's id and takes the link's current fields, so the entity's value and any trait change aimed at it carry
 * over. A linked group's groups get fresh ids. Null when the link or its original is gone.
 */
export function detachStatLink(
  world: StatLinkWorld, entity: Entity, linkId: string, newGroupId: () => string = randomUUID,
): { entity: Entity; newId: string } | null {
  const link = entity.statLinks?.find((l) => l.id === linkId);
  const original = link && statOriginalOf(world, link.originalId);
  if (!link || !original) return null;
  const own = entity.stats ?? [];
  const held = new Set(own.map((s) => s.id));
  const unlinked = removeStatLink(entity, linkId);
  const withTree = (stats: Stat[], groups: StatGroup[]): Entity => {
    const allGroups = [...(entity.statGroups ?? []), ...groups];
    return withEntityLists(unlinked, { stats: statsInTreeOrder(allGroups, [...own, ...stats]), statGroups: allGroups });
  };
  if (original.kind === 'stat') {
    const copy = held.has(original.item.id) ? [] : [linkedStat(original.item, link)];
    return { entity: withTree(copy, []), newId: original.item.id };
  }
  const sub = statSubtree(world, original.item);
  const ids = new Map([original.item, ...sub.groups].map((g) => [g.id, newGroupId()] as const));
  const rootId = ids.get(original.item.id)!;
  const groups = [
    { ...original.item, id: rootId, parentId: link.groupId, order: link.order ?? 0 },
    ...sub.groups.map((g) => ({ ...g, id: ids.get(g.id)!, parentId: ids.get(g.parentId!)! })),
  ];
  const stats = sub.stats
    .filter((s) => !held.has(s.id))
    .map((s) => linkedStat(s, link, { groupId: ids.get(s.groupId!)!, ...(s.order !== undefined ? { order: s.order } : {}) }));
  return { entity: withTree(stats, groups), newId: rootId };
}

// ---- Resolution ----

/** An entity's stat tree as play reads it, with each link expanded. */
export interface EntityStatTree {
  /** Its own stats and each linked stat, in tree order. */
  stats: Stat[];
  /** Its own groups, then each linked group at its link's place with the groups below it. */
  groups: StatGroup[];
  /** A linked stat or group's id → the link that brought it. Own items are absent. */
  linkOf: ReadonlyMap<string, StatLink>;
}

/** The entity's links in its tree's order: by place among its own groups, then by order. */
export const statLinksInTreeOrder = (entity: Entity): StatLink[] => ownerLinksInTreeOrder(entity.statGroups ?? [], entity.statLinks ?? []);

/**
 * The entity's stats as play reads them: its own and each link's, a stat link's original in the link's place and
 * a group link's original there with its live subtree below. Links run in tree order, and anything the entity
 * owns or an earlier link brought is skipped, so each stat appears once.
 */
export function resolvedEntityStatTree(world: StatLinkWorld, entity: Entity): EntityStatTree {
  const own = entity.stats ?? [];
  const ownGroups = entity.statGroups ?? [];
  if (!entity.statLinks?.length) return { stats: own, groups: ownGroups, linkOf: new Map() };
  const held = new Set(own.map((s) => s.id));
  const stats: Stat[] = [];
  const groups: StatGroup[] = [];
  const linkOf = new Map<string, StatLink>();
  const take = (id: string, link: StatLink) => { held.add(id); linkOf.set(id, link); };
  for (const link of statLinksInTreeOrder(entity)) {
    const original = statOriginalOf(world, link.originalId);
    if (!original || held.has(original.item.id)) continue;
    if (original.kind === 'stat') {
      stats.push(linkedStat(original.item, link));
      take(original.item.id, link);
      continue;
    }
    // A subgroup already brought took its own subtree with it, so filtering by id keeps the rest in place.
    const sub = statSubtree(world, original.item);
    const subGroups = sub.groups.filter((g) => !held.has(g.id));
    const subStats = sub.stats.filter((s) => !held.has(s.id));
    groups.push({ ...original.item, parentId: link.groupId, order: link.order ?? 0 }, ...subGroups);
    stats.push(...subStats.map((s) => linkedStat(s, link, placeOf(s))));
    for (const item of [original.item, ...subGroups, ...subStats]) take(item.id, link);
  }
  if (!stats.length && !groups.length) return { stats: own, groups: ownGroups, linkOf };
  const allGroups = [...ownGroups, ...groups];
  return { stats: statsInTreeOrder(allGroups, [...own, ...stats]), groups: allGroups, linkOf };
}

/** The entity's stats as play reads them; see {@link resolvedEntityStatTree}. */
export const resolvedEntityStats = (world: StatLinkWorld, entity: Entity): Stat[] => resolvedEntityStatTree(world, entity).stats;

/** Every link to the originals, counted across `entities`. */
export function statLinksTo(entities: readonly Entity[], originalIds: ReadonlySet<string>): number {
  return entities.reduce((n, e) => n + (e.statLinks ?? []).filter((l) => originalIds.has(l.originalId)).length, 0);
}

/** Every entity without its links to the originals; the same array when none links one. */
export function dropStatLinksTo(entities: Entity[], originalIds: ReadonlySet<string>): Entity[] {
  const hit = (e: Entity) => e.statLinks?.some((l) => originalIds.has(l.originalId));
  if (!entities.some(hit)) return entities;
  return entities.map((e) => (hit(e) ? withStatLinks(e, e.statLinks!.filter((l) => !originalIds.has(l.originalId))) : e));
}

/** The world after its Blueprints stat group goes. */
export interface StatBlueprintsRemoval {
  stats: Stat[];
  statGroups: StatGroup[];
  entities: Entity[];
  /** Links turned into their entity's own stats. */
  detached: number;
  /** Whether any unlinked Blueprint stat or group moves to the top level, where its stats become global stats. */
  movedUp: boolean;
}

/**
 * Remove the Blueprints stat group: each link into it is detached into its entity, each linked original and
 * everything below it is deleted, and the rest move to the top level. Null without a Blueprints group.
 */
export function removeStatBlueprints(world: StatLinkWorld, entities: readonly Entity[]): StatBlueprintsRemoval | null {
  const bp = blueprintsGroup(world.statGroups);
  if (!bp) return null;
  const inside = new Set([...statBlueprintIds(world), ...blueprintsSubtreeIds(world.statGroups)]);
  const gone = new Set<string>();
  let detached = 0;
  const entitiesOut = entities.map((entity) => {
    let next = entity;
    for (const link of entity.statLinks ?? []) {
      if (!statOriginalOf(world, link.originalId)) continue;
      statBroughtIds(world, link.originalId).forEach((id) => gone.add(id));
      const res = detachStatLink(world, next, link.id);
      if (res) { next = res.entity; detached += 1; }
    }
    return next;
  });
  const stats = world.stats.filter((s) => !gone.has(s.id)).map((s) => (s.groupId === bp.id ? { ...s, groupId: null } : s));
  const statGroups = world.statGroups
    .filter((g) => g.id !== bp.id && !gone.has(g.id))
    .map((g) => (g.parentId === bp.id ? { ...g, parentId: null } : g));
  const movedUp = [...stats, ...statGroups].some((item) => inside.has(item.id));
  return { stats, statGroups, entities: entitiesOut, detached, movedUp };
}

/** The world as play reads it: the global stats without Blueprints, and each entity with its stats and stat
 *  groups resolved through its links. Each list comes back as given when nothing changes it. */
export function playStatWorld(world: StatLinkWorld & { stats: Stat[]; entities: Entity[] }): { stats: Stat[]; entities: Entity[] } {
  const stats = globalStatsOf(world.stats, world.statGroups);
  if (!world.entities.some((e) => e.statLinks?.length)) return { stats, entities: world.entities };
  const entities = world.entities.map((e) => {
    if (!e.statLinks?.length) return e;
    const tree = resolvedEntityStatTree(world, e);
    return withEntityLists(e, { statLinks: [], stats: tree.stats, statGroups: tree.groups });
  });
  return { stats, entities };
}

// ---- The entity Stats tab's tree ----

/** A row of an entity's Stats tab that a link brings. */
export interface LinkedStatRow {
  link: StatLink;
  /** The original stat or group the row reads. */
  originalId: string;
  kind: 'stat' | 'group';
  /** The link's own row, under the link's id: a stat link's stat or a group link's group. Rows below a group
   *  link's root keep the original ids. */
  root: boolean;
  /** No original to read, so the row shows the link's stored name. */
  unbound: boolean;
}

export interface EntityStatRows {
  stats: Stat[];
  groups: StatGroup[];
  linked: ReadonlyMap<string, LinkedStatRow>;
}

/** The entity's Stats tab tree: its own stats and groups with each link expanded as play reads it. A link with no
 *  original is a stat row with its stored name. */
export function entityStatRows(world: StatLinkWorld, entity: Entity): EntityStatRows {
  const tree = resolvedEntityStatTree(world, entity);
  const linked = new Map<string, LinkedStatRow>();
  const rowId = (id: string) => {
    const link = tree.linkOf.get(id);
    return link && link.originalId === id ? link.id : id;
  };
  const mark = (id: string, kind: LinkedStatRow['kind']) => {
    const link = tree.linkOf.get(id);
    if (link) linked.set(rowId(id), { link, originalId: id, kind, root: link.originalId === id, unbound: false });
  };
  const groups = tree.groups.map((g) => {
    if (!tree.linkOf.has(g.id)) return g;
    mark(g.id, 'group');
    return { ...g, id: rowId(g.id), parentId: g.parentId && rowId(g.parentId) };
  });
  const stats = tree.stats.map((s) => {
    if (!tree.linkOf.has(s.id)) return s;
    mark(s.id, 'stat');
    return { ...s, id: rowId(s.id), groupId: s.groupId && rowId(s.groupId) };
  });
  const unbound = (entity.statLinks ?? []).filter((l) => !statOriginalOf(world, l.originalId)).map((link): Stat => {
    linked.set(link.id, { link, originalId: link.originalId, kind: link.kind, root: true, unbound: true });
    return { ...newStat(link.id, link.originalName), descriptors: [], ...placeOf(link) };
  });
  return { stats: unbound.length ? statsInTreeOrder(groups, [...stats, ...unbound]) : stats, groups, linked };
}

/**
 * The entity after a drag in its Stats tab tree: its own stats and groups and each link's root row take their new
 * places. Null when the drag moves a row a group link brings, or drops anything inside one.
 */
export function applyEntityStatRows(entity: Entity, rows: EntityStatRows, next: { groups: StatGroup[]; stats: Stat[] }): Entity | null {
  const linkedGroups = new Set(rows.groups.filter((g) => rows.linked.has(g.id)).map((g) => g.id));
  const parentBefore = new Map<string, string | null>([
    ...rows.stats.map((s) => [s.id, s.groupId ?? null] as const),
    ...rows.groups.map((g) => [g.id, g.parentId] as const),
  ]);
  const places = [
    ...next.stats.map((s) => ({ id: s.id, parentId: s.groupId ?? null })),
    ...next.groups.map((g) => ({ id: g.id, parentId: g.parentId })),
  ];
  for (const { id, parentId } of places) {
    const row = rows.linked.get(id);
    if (row && !row.root ? parentId !== parentBefore.get(id) : parentId !== null && linkedGroups.has(parentId)) return null;
  }
  const own = new Map((entity.stats ?? []).map((s) => [s.id, s]));
  const isRow = (id: string) => !rows.linked.has(id) || rows.linked.get(id)!.root;
  const leaves = [
    ...next.stats.filter((s) => isRow(s.id)).map((s) => ({ id: s.id, ...placeOf(s) })),
    ...next.groups.filter((g) => rows.linked.get(g.id)?.root).map((g) => ({ id: g.id, ...placeOf({ groupId: g.parentId, order: g.order }) })),
  ];
  return withEntityStatTree(entity, leaves, next.groups.filter((g) => !rows.linked.has(g.id)), (leaf) => {
    const stat = own.get(leaf.id);
    return stat && { ...stat, ...placeOf(leaf) };
  });
}

// ---- Migration ----

/** Keep one Blueprints group: each later one loses the mark and nests, with what it holds, under the first. */
export function mergeStatBlueprintsGroups(world: StatLinkWorld): StatGroup[] {
  const marked = world.statGroups.filter((g) => g.system === 'blueprints');
  if (marked.length < 2) return world.statGroups as StatGroup[];
  const [first, ...extra] = marked;
  const extraIds = new Set(extra.map((g) => g.id));
  let order = world.stats.filter((s) => s.groupId === first.id).length + world.statGroups.filter((g) => g.parentId === first.id).length;
  return world.statGroups.map((g) => {
    if (!extraIds.has(g.id)) return g;
    const { system: _s, ...rest } = g;
    return { ...rest, parentId: first.id, order: order++ };
  });
}

/**
 * Keep one link per original on an owner. A link that another one on the owner already brings, the same original
 * or a stat or group inside a linked group, folds into the outermost such link, the first among equals. Its
 * overrides fill only the fields the kept link leaves live.
 */
export function mergeDuplicateStatLinks(world: StatLinkWorld, links: readonly StatLink[]): StatLink[] {
  const brought = links.map((l) => new Set(statBroughtIds(world, l.originalId)));
  const into = links.map((l, i) => {
    let best = -1;
    links.forEach((m, j) => {
      const covers = j !== i && (m.originalId === l.originalId ? j < i : brought[j].has(l.originalId));
      if (covers && (best === -1 || brought[j].size > brought[best].size)) best = j;
    });
    return best;
  });
  if (into.every((j) => j === -1)) return [...links];
  const rootOf = (i: number) => {
    for (let seen = 0; into[i] !== -1 && seen < links.length; seen++) i = into[i];
    return i;
  };
  const kept = links.map((l) => ({ ...l }));
  links.forEach((l, i) => {
    if (into[i] === -1 || !l.overrides) return;
    const root = kept[rootOf(i)];
    const map = { ...root.overrides };
    for (const [statId, fields] of Object.entries(l.overrides)) map[statId] = { ...fields, ...map[statId] };
    root.overrides = map;
  });
  return kept.filter((_, i) => into[i] === -1);
}
