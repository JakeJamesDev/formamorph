/**
 * Which stat a route in stat code reaches, with no playthrough: every box of code in a world, the runs each
 * box gets, and the owner's stat that `stats.X`, `owner.stats.X`, `entities[x].stats.X`, or
 * `persona.stats.X` lands on from each run. The Test Bench rules and the rename planner read this one
 * resolution.
 *
 * Every authored entity counts as in the game, and `persona` may be any entity that can be played (Q11).
 */

import type { Entity, Placeholder, Stat, StatGroup, StatLink } from '@/types';
import { canBePlayer } from './owners';
import { codeRenameChains, type CodeRenameKey } from './codeRenameChains';
import { hasEntityKey, statCodeName, statsByCodeName } from './statCodeNames';
import { CODE_FIELD, filledCodeBoxes, type StatCodeTiming } from './statCodeTiming';
import {
  blueprintGroupStats, playerStatsOf, resolvedEntityStatTree, statBlueprintIds, statLinkState, type StatLinkWorld,
} from './statLinks';

/** What the resolution reads from a world. */
export interface StatRouteWorld {
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
  entities?: readonly Entity[];
  /** Every placeholder, owned ones included, since stat and entity names read through their chips. */
  placeholders: readonly Placeholder[];
}

/** One owner whose stats code reaches: the world, an entity, or a Blueprint group in its own box. */
export interface CodeOwner {
  entity: Entity | null;
  /** Its stats as play reads them. An entity's include the stats its links bring. */
  stats: Stat[];
  /** Its stats as its stat map keys them by code name. */
  byCodeName: ReadonlyMap<string, Stat>;
  /** A linked stat's id → the link that brings it. Empty off an entity. */
  linkOf: ReadonlyMap<string, StatLink>;
}

type EntityOwner = CodeOwner & { entity: Entity };

/** Every owner stat code reaches. */
export interface CodeOwners {
  world: CodeOwner;
  /** The world, then each entity in authored order. */
  all: CodeOwner[];
  /** Each entity as `entities` keys it by code name. */
  byName: ReadonlyMap<string, EntityOwner>;
  /** What `persona` may be (Q11). */
  playable: EntityOwner[];
  statWorld: StatLinkWorld;
  /** Stats as a stat map keys them by code name. */
  byCodeName: (stats: readonly Stat[]) => ReadonlyMap<string, Stat>;
  /** A stat or entity name as code reads it. */
  codeName: (name: string | undefined) => string;
}

/** A stat authored off runs no code and takes no write. */
export const isStatOn = (stat: Stat): boolean => stat.enabled !== false;

const NO_LINKS: ReadonlyMap<string, StatLink> = new Map();

export function statCodeOwners(world: StatRouteWorld): CodeOwners {
  const codeName = (text: string | undefined) => statCodeName(text, world.placeholders);
  const statWorld = { stats: [...world.stats ?? []], statGroups: [...world.statGroups ?? []] };
  const byCodeName = (stats: readonly Stat[]) => statsByCodeName(stats, (stat) => codeName(stat.name), isStatOn);
  const worldStats = playerStatsOf(statWorld.stats, statWorld.statGroups);
  const worldOwner: CodeOwner = { entity: null, stats: worldStats, byCodeName: byCodeName(worldStats), linkOf: NO_LINKS };
  const entities = (world.entities ?? []).map((entity): EntityOwner => {
    const tree = resolvedEntityStatTree(statWorld, entity);
    return { entity, stats: tree.stats, byCodeName: byCodeName(tree.stats), linkOf: tree.linkOf };
  });
  return {
    world: worldOwner,
    all: [worldOwner, ...entities],
    byName: new Map(entities.map((o) => [codeName(o.entity.name), o] as const).filter(([name]) => hasEntityKey(name))),
    playable: entities.filter((o) => canBePlayer(o.entity)),
    statWorld,
    byCodeName,
    codeName,
  };
}

/** One route's literal keys: its global, the entity an `entities` route names, and the stat's code name.
 *  A `self` route names no stat. */
export interface StatRoute {
  root: 'self' | 'stats' | 'owner' | 'entities' | 'persona';
  entity?: string;
  stat: string | null;
}

/** One run of a box: the stat it runs as, and what `owner` holds there. Null is the empty `owner`. */
export interface CodeRun {
  self: Stat;
  owner: CodeOwner | null;
}

/** One owner's stat a route lands on. */
export interface StatTarget {
  owner: CodeOwner;
  stat: Stat;
}

/** Each owner's stat `route` lands on from one run. */
export function routeTargets(owners: CodeOwners, run: CodeRun, route: StatRoute): StatTarget[] {
  const on = (owner: CodeOwner | null | undefined): StatTarget[] => {
    const stat = owner && route.stat !== null ? owner.byCodeName.get(route.stat) : undefined;
    return owner && stat ? [{ owner, stat }] : [];
  };
  switch (route.root) {
    case 'self': return [{ owner: run.owner ?? owners.world, stat: run.self }];
    case 'stats': return on(owners.world);
    case 'owner': return on(run.owner);
    case 'entities': return on(owners.byName.get(route.entity ?? ''));
    case 'persona': return owners.playable.flatMap((target) => on(target));
  }
}

/** Where a box's code is authored. */
export type CodeHome =
  /** A global stat's own box, a Blueprint stat's included. */
  | { kind: 'stat'; statId: string }
  /** An entity's own stat. */
  | { kind: 'entity'; entityId: string; statId: string }
  /** An owner's link that overrides this box of the Blueprint stat it brings. */
  | { kind: 'link'; entityId: string; linkId: string; statId: string };

/** One filled box of stat code. */
export interface StatCodeBox {
  home: CodeHome;
  timing: StatCodeTiming;
  code: string;
  /** The stat as its runs read it: an owner's linked copy for a link's box. */
  stat: Stat;
  /** The entity an own or link box sits on. */
  entity: Entity | null;
  /** What `owner` holds where the editor reads the box: the empty entry for a global stat, the group alone for
   *  a Blueprint stat (Q10), the entity otherwise. */
  owner: CodeOwner | null;
  /** Each run the box gets in play: one per owner for a Blueprint stat whose link leaves the box alone. */
  runs: CodeRun[];
}

/** Whether a link overrides one box of the stat it brings. */
export const overridesBox = (link: StatLink, original: Stat, timing: StatCodeTiming) =>
  statLinkState(original, link).overridden.includes(CODE_FIELD[timing]);

/**
 * Every filled box in the world once, in this order: the global stats', each Blueprint stat's, then each
 * entity's own stats' and the boxes its links override, in the entity's tree order.
 */
export function statCodeBoxes(owners: CodeOwners): StatCodeBox[] {
  const { statWorld } = owners;
  const blueprintIds = statBlueprintIds(statWorld);
  const worldBoxes = owners.world.stats.flatMap((stat) => filledCodeBoxes(stat).map((box): StatCodeBox => ({
    home: { kind: 'stat', statId: stat.id }, ...box, stat, entity: null, owner: null, runs: [{ self: stat, owner: null }],
  })));
  const blueprintBoxes = statWorld.stats.filter((stat) => blueprintIds.has(stat.id)).flatMap((stat) => {
    const group = blueprintGroupStats(statWorld, stat);
    const owner: CodeOwner = { entity: null, stats: group, byCodeName: owners.byCodeName(group), linkOf: NO_LINKS };
    return filledCodeBoxes(stat).map((box): StatCodeBox => ({
      home: { kind: 'stat', statId: stat.id }, ...box, stat, entity: null, owner, runs: [],
    }));
  });
  const blueprintBox = new Map(blueprintBoxes.map((box) => [`${box.stat.id}:${box.timing}`, box]));
  const entityBoxes = owners.all.flatMap((owner) => {
    const { entity } = owner;
    if (!entity) return [];
    return owner.stats.flatMap((stat) => filledCodeBoxes(stat).flatMap((box): StatCodeBox[] => {
      const link = owner.linkOf.get(stat.id);
      const original = link && statWorld.stats.find((s) => s.id === stat.id);
      const run: CodeRun = { self: stat, owner };
      if (!link) {
        return [{ home: { kind: 'entity', entityId: entity.id, statId: stat.id }, ...box, stat, entity, owner, runs: [run] }];
      }
      if (original && overridesBox(link, original, box.timing)) {
        const home: CodeHome = { kind: 'link', entityId: entity.id, linkId: link.id, statId: stat.id };
        return [{ home, ...box, stat, entity, owner, runs: [run] }];
      }
      // A box the link leaves alone runs the Blueprint's code for this owner.
      blueprintBox.get(`${stat.id}:${box.timing}`)?.runs.push(run);
      return [];
    }));
  });
  return [...worldBoxes, ...blueprintBoxes, ...entityBoxes];
}

/** One literal route to a stat in a box's code. */
export interface StatCodeReference {
  box: StatCodeBox;
  route: Exclude<StatRoute['root'], 'self'>;
  /** The entity an `entities` route names, by code name. */
  entity?: string;
  /** The stat's code name as the key spells it. */
  stat: string;
  /** Every stat the key reaches, across the box's runs and the editor's reading of it. */
  targets: StatTarget[];
  /** The key's own text in the box's code. */
  from: number;
  to: number;
  key: CodeRenameKey;
}

/** One chain that names a stat: its route, and the key that names the stat. */
export interface RouteKey {
  route: StatReferenceRoute;
  key: CodeRenameKey;
}

type StatReferenceRoute = StatRoute & { root: StatCodeReference['route']; stat: string };

/** The route each chain off a global spells, in text order. */
export function routesIn(code: string): RouteKey[] {
  const found: RouteKey[] = codeRenameChains(code, 'stats').map((chain) => ({ route: { root: 'stats', stat: chain[0].name }, key: chain[0] }));
  for (const root of ['owner', 'persona'] as const) {
    for (const chain of codeRenameChains(code, root)) {
      if (chain[0].name === 'stats' && chain[1]) found.push({ route: { root, stat: chain[1].name }, key: chain[1] });
    }
  }
  for (const chain of codeRenameChains(code, 'entities')) {
    if (chain[1]?.name === 'stats' && chain[2]) {
      found.push({ route: { root: 'entities', entity: chain[0].name, stat: chain[2].name }, key: chain[2] });
    }
  }
  return found.sort((a, b) => a.key.keyFrom - b.key.keyFrom);
}

/** Every route in one box that reaches a stat, in text order. */
export function boxReferences(owners: CodeOwners, box: StatCodeBox): StatCodeReference[] {
  const runs: CodeRun[] = [{ self: box.stat, owner: box.owner }, ...box.runs];
  return routesIn(box.code).flatMap(({ route, key }) => {
    // One target per owner and stat, however many runs reach it.
    const seen = new Map<CodeOwner, Set<string>>();
    const targets: StatTarget[] = [];
    for (const target of runs.flatMap((run) => routeTargets(owners, run, route))) {
      const ids = seen.get(target.owner) ?? new Set<string>();
      seen.set(target.owner, ids);
      if (ids.has(target.stat.id)) continue;
      ids.add(target.stat.id);
      targets.push(target);
    }
    if (!targets.length) return [];
    const { root, entity, stat } = route;
    return [{ box, route: root, ...(entity !== undefined ? { entity } : {}), stat, targets, from: key.keyFrom, to: key.keyTo, key }];
  });
}

/** Every route to a stat in every box of the world. */
export function statCodeReferences(world: StatRouteWorld): StatCodeReference[] {
  const owners = statCodeOwners(world);
  return statCodeBoxes(owners).flatMap((box) => boxReferences(owners, box));
}

/** Where a stat's name is authored. A null entity is the world. */
export interface StatNameHome {
  entityId: string | null;
  statId: string;
}

/** Where a reached stat's name is authored: on its entity for one of the entity's own stats, else in the
 *  world, since a linked copy reads its Blueprint's name. */
export const nameHomeOf = ({ owner, stat }: StatTarget): StatNameHome => ({
  entityId: owner.entity && !owner.linkOf.has(stat.id) ? owner.entity.id : null,
  statId: stat.id,
});
