// Stat Blueprints and Links: the world's Blueprints stat group, an entity's links to the stats in it, and the
// stats each entity owns once its links are read through their originals. This module is the one place that
// expands a stat link, for the editor and for play.

import type { Entity, Stat, StatGroup, StatLink, StatLinkFields, StatLinkOverrides } from '@/types';
import { effectiveRecord, sameValue, withOverride, withoutOverride, type EffectiveRecord } from './blueprints';
import { groupsBelow } from './traitTree';
import { removeStatGroup, statRootCount, statsInTreeOrder } from './statGroupTree';
import { buildTree, flattenTree, type TreeLeaf } from './groupTree';
import type { BearerChoice } from './bearerChoices';

/** The tree place a link or leaf carries: its group and, when set, its order. */
export const placeOf = (item: { groupId?: string | null; order?: number }): { groupId: string | null; order?: number } =>
  ({ groupId: item.groupId ?? null, ...(item.order !== undefined ? { order: item.order } : {}) });

/** What stat link resolution reads from a world. */
export interface StatLinkWorld {
  stats: readonly Stat[];
  statGroups: readonly StatGroup[];
}

// ---- The Blueprints group ----

/** The world's Blueprints stat group, when the author added one. */
export const statBlueprintsGroup = (groups: readonly StatGroup[]): StatGroup | undefined =>
  groups.find((g) => g.system === 'blueprints');

/** Blueprints and every world stat group below it. Empty without a Blueprints group. */
export function statBlueprintsSubtreeIds(groups: readonly StatGroup[]): Set<string> {
  const blueprints = statBlueprintsGroup(groups);
  return new Set(blueprints ? [blueprints.id, ...groupsBelow(groups as StatGroup[], blueprints.id).map((g) => g.id)] : []);
}

/** The world stats inside Blueprints: the only stats a link may point at. */
export function statBlueprintIds(world: StatLinkWorld): Set<string> {
  const inBlueprints = statBlueprintsSubtreeIds(world.statGroups);
  return new Set(world.stats.filter((s) => s.groupId != null && inBlueprints.has(s.groupId)).map((s) => s.id));
}

/** The Blueprint stat with this id, or undefined when the id names no stat inside Blueprints. */
export function statBlueprint(world: StatLinkWorld, id: string): Stat | undefined {
  return statBlueprintIds(world).has(id) ? world.stats.find((s) => s.id === id) : undefined;
}

/** The Blueprint stats and the groups that hold one, as a drill-down flyout's rows in tree order. A row in the
 *  Blueprints group itself sits at the top level. */
export function statBlueprintChoices(world: StatLinkWorld): BearerChoice[] {
  const bp = statBlueprintsGroup(world.statGroups);
  if (!bp) return [];
  const inside = statBlueprintsSubtreeIds(world.statGroups);
  const up = (id: string | null | undefined) => (id === bp.id ? null : id ?? null);
  const groups = world.statGroups.filter((g) => g.id !== bp.id && inside.has(g.id)).map((g) => ({ ...g, parentId: up(g.parentId) }));
  const stats = world.stats.filter((s) => s.groupId != null && inside.has(s.groupId)).map((s) => ({ ...s, groupId: up(s.groupId) }));
  const holdsStat = new Set<string>();
  for (const s of stats) for (let at = s.groupId; at; at = groups.find((g) => g.id === at)?.parentId ?? null) holdsStat.add(at);
  return flattenTree(buildTree(groups, stats)).flatMap((row): BearerChoice[] => {
    if (row.leaf) return [{ kind: 'bearer', id: row.leaf.id, name: row.leaf.name, parentId: row.parentId }];
    return row.group && holdsStat.has(row.group.id) ? [{ kind: 'group', id: row.group.id, name: row.group.name, parentId: row.parentId }] : [];
  });
}

/** Whether a regrouped world keeps the Blueprints group at the top level and every linked original inside it. */
export function dropKeepsBlueprints(next: StatLinkWorld, entities: readonly Entity[]): boolean {
  if ((statBlueprintsGroup(next.statGroups)?.parentId ?? null) !== null) return false;
  const inside = statBlueprintIds(next);
  const held = new Set(next.stats.map((s) => s.id));
  return entities.every((e) => (e.statLinks ?? []).every((l) => inside.has(l.originalId) || !held.has(l.originalId)));
}

/** The world's stats without Blueprints: the player's stats. The same list when it holds no Blueprint. */
export function playerStatsOf<T extends Stat>(stats: T[], groups: readonly StatGroup[]): T[] {
  const inBlueprints = statBlueprintsSubtreeIds(groups);
  if (!inBlueprints.size || !stats.some((s) => s.groupId != null && inBlueprints.has(s.groupId))) return stats;
  return stats.filter((s) => s.groupId == null || !inBlueprints.has(s.groupId));
}

// ---- One link ----

/** The overridable fields as the original carries them, absent ones read as off or empty. */
export const statLinkFieldsOf = (stat: Stat): StatLinkFields => ({
  type: stat.type,
  description: stat.description ?? '',
  min: stat.min,
  max: stat.max,
  value: stat.value ?? 0,
  regen: stat.regen ?? 0,
  descriptors: stat.descriptors ?? [],
  thresholdUnit: stat.thresholdUnit ?? 'raw',
  beforeCode: stat.beforeCode ?? '',
  code: stat.code ?? '',
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

/** The original as `link` reads it, in the link's place. The id and name stay the original's, so in play each
 *  bearer holds its own value under the original's id. */
export function linkedStat(original: Stat, link: StatLink): Stat {
  const { groupId: _g, order: _o, ...base } = original;
  const at = placeOf(link);
  if (!link.overrides?.[original.id]) return { ...base, ...at };
  const { record, overridden } = statLinkState(original, link);
  const fields = Object.fromEntries(overridden.map((field) => [field, record[field]]));
  // An overridden Initial Value stands alone: a stored starting value would otherwise win at the seed.
  const { starting: _s, ...rest } = base;
  return { ...(overridden.includes('value') ? rest : base), ...fields, ...at };
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

/** The link reading `field` on one original stat live again. The same link when it did not override it. */
export function resetStatLinkField(link: StatLink, statId: string, field: keyof StatLinkFields): StatLink {
  const current = link.overrides?.[statId];
  return current?.[field] ? withStatOverrides(link, statId, withoutOverride(current, field)) : link;
}

/** The link reading its original live everywhere: Reset to Blueprint. */
export function resetStatLinkOverrides(link: StatLink): StatLink {
  const { overrides: _drop, ...rest } = link;
  return rest;
}

// ---- An entity's links ----

/** The entity with its stat links replaced. No links are stored as absent. */
export function withStatLinks(entity: Entity, links: StatLink[]): Entity {
  const { statLinks: _l, ...rest } = entity;
  return links.length ? { ...rest, statLinks: links } : rest;
}

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

/** Link a Blueprint stat at the end of the entity's top level. Null when the id is not a Blueprint stat or the
 *  entity already links it. */
export function addStatLink(world: StatLinkWorld, entity: Entity, originalId: string, id: string): Entity | null {
  const original = statBlueprint(world, originalId);
  if (!original || linksStat(entity, originalId)) return null;
  const link: StatLink = { id, originalId, kind: 'stat', originalName: original.name, groupId: null, order: entityStatRootCount(entity) };
  return withStatLinks(entity, [...(entity.statLinks ?? []), link]);
}

/** Copy a Blueprint stat into the entity as its own stat under `id`, at the end of its top level. Null when the
 *  id is not a Blueprint stat. */
export function copyStatBlueprint(world: StatLinkWorld, entity: Entity, originalId: string, id: string): Entity | null {
  const original = statBlueprint(world, originalId);
  if (!original) return null;
  const copy: Stat = { ...original, id, groupId: null, order: entityStatRootCount(entity) };
  return { ...entity, stats: [...(entity.stats ?? []), copy] };
}

/** Remove one link. The original is untouched. */
export const removeStatLink = (entity: Entity, linkId: string): Entity =>
  withStatLinks(entity, (entity.statLinks ?? []).filter((l) => l.id !== linkId));

/** Write an editor's edit of a linked stat as the link's overrides on the fields it changed. The entity as it is
 *  when the original is gone. */
export function editStatLink(world: StatLinkWorld, entity: Entity, linkId: string, edited: Stat): Entity {
  const link = entity.statLinks?.find((l) => l.id === linkId);
  const original = link && world.stats.find((s) => s.id === link.originalId);
  return original ? withStatLink(entity, linkId, (l) => setStatLinkEdits(l, original, edited)) : entity;
}

/** Read one field of one original stat a link brings live again. */
export const resetStatLinkFieldOn = (entity: Entity, linkId: string, statId: string, field: keyof StatLinkFields): Entity =>
  withStatLink(entity, linkId, (l) => resetStatLinkField(l, statId, field));

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
  const { stats: _s, statGroups: _g, ...rest } = withStatLinks(entity, nextLinks);
  return { ...rest, ...(stats.length ? { stats } : {}), ...(groups.length ? { statGroups: groups } : {}) };
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

// ---- Resolution ----

/** The entity's stats as play reads them: its own stats and each link's original as the link reads it, in tree
 *  order. A link whose original left Blueprints, or a second link to one original, brings nothing. */
export function resolvedEntityStats(world: StatLinkWorld, entity: Entity): Stat[] {
  const links = entity.statLinks ?? [];
  if (!links.length) return entity.stats ?? [];
  const blueprints = statBlueprintIds(world);
  const own = entity.stats ?? [];
  const held = new Set(own.map((s) => s.id));
  const linked = links.flatMap((link) => {
    const original = blueprints.has(link.originalId) && !held.has(link.originalId)
      ? world.stats.find((s) => s.id === link.originalId) : undefined;
    if (!original) return [];
    held.add(original.id);
    return [linkedStat(original, link)];
  });
  return linked.length ? statsInTreeOrder(entity.statGroups ?? [], [...own, ...linked]) : own;
}

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
  /** Links turned into their entity's own stat. */
  detached: number;
  /** Whether any unlinked Blueprint stat or group moves to the top level, where it becomes a player stat. */
  movedUp: boolean;
}

/**
 * Remove the Blueprints stat group: each link becomes its entity's own stat as the link reads it, under the
 * original's id so the entity keeps its value; each linked original is deleted; the rest move to the top level.
 * Null without a Blueprints group.
 */
export function removeStatBlueprints(world: StatLinkWorld, entities: readonly Entity[]): StatBlueprintsRemoval | null {
  const bp = statBlueprintsGroup(world.statGroups);
  if (!bp) return null;
  const blueprints = statBlueprintIds(world);
  const gone = new Set<string>();
  let detached = 0;
  const entitiesOut = entities.map((entity) => {
    const links = (entity.statLinks ?? []).filter((l) => blueprints.has(l.originalId));
    if (!links.length) return entity;
    const own = new Set((entity.stats ?? []).map((s) => s.id));
    const copies = links.flatMap((link) => {
      gone.add(link.originalId);
      const original = world.stats.find((s) => s.id === link.originalId)!;
      if (own.has(original.id)) return [];
      own.add(original.id);
      detached += 1;
      return [linkedStat(original, link)];
    });
    const kept = (entity.statLinks ?? []).filter((l) => !blueprints.has(l.originalId));
    return withStatLinks({ ...entity, stats: statsInTreeOrder(entity.statGroups ?? [], [...(entity.stats ?? []), ...copies]) }, kept);
  });
  const stats = world.stats.filter((s) => !gone.has(s.id)).map((s) => (s.groupId === bp.id ? { ...s, groupId: null } : s));
  const statGroups = world.statGroups.filter((g) => g.id !== bp.id).map((g) => (g.parentId === bp.id ? { ...g, parentId: null } : g));
  const movedUp = world.stats.some((s) => blueprints.has(s.id) && !gone.has(s.id))
    || world.statGroups.some((g) => g.parentId === bp.id);
  return { stats, statGroups, entities: entitiesOut, detached, movedUp };
}

/** The world as play reads it: the player's stats without Blueprints, and each entity with its stats resolved
 *  through its links. Each list comes back as given when nothing changes it. */
export function playStatWorld(world: StatLinkWorld & { stats: Stat[]; entities: Entity[] }): { stats: Stat[]; entities: Entity[] } {
  const stats = playerStatsOf(world.stats, world.statGroups);
  if (!world.entities.some((e) => e.statLinks?.length)) return { stats, entities: world.entities };
  const entities = world.entities.map((e) => {
    if (!e.statLinks?.length) return e;
    const { statLinks: _l, ...rest } = e;
    const resolved = resolvedEntityStats(world, e);
    return resolved.length ? { ...rest, stats: resolved } : rest;
  });
  return { stats, entities };
}
