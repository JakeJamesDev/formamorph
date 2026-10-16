// What reads a stat on its owner: the trait rows that reach it, as play routes them, and every script that names
// it: stat, trait and world. A move to another owner that would leave one of them pointing at nothing is refused.

import type { Entity, Placeholder, Script, Stat, StatChange, Trait, TraitGroup, TraitStatToggle } from '@/types';
import { resolveOwners } from './owners';
import { filledScripts } from './scripts';
import { routeTargets, routesIn, statCodeOwners, type StatTarget, type TraitRun } from './statCodeTargets';
import { worldScriptList } from './worldScripts';
import { globalStatsOf, resolvedEntityStats, type StatLinkWorld } from './statLinks';
import { statRowSide } from './traitTree';

/** What a stat reader reads from a world. */
export interface StatReaderWorld extends StatLinkWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  placeholders?: readonly Placeholder[];
  /** The world's own scripts. */
  scripts?: readonly Script[];
}

/** What breaks when a stat changes owner. `stat` names the stat the move would take away. */
export type StatReader =
  /** A trait's stat change or stat toggle reaches the stat. */
  | { kind: 'change' | 'toggle'; trait: string }
  /** The code of `stat`, which stays or runs elsewhere, reads the stat. */
  | { kind: 'readBy'; stat: string }
  /** A script of `trait` reads the stat. */
  | { kind: 'readByTrait'; trait: string }
  /** A world script reads the stat. */
  | { kind: 'readByWorld' }
  /** The moved stat's own code reads `stat` through `owner`, which stays, or which the world's empty owner lacks. */
  | { kind: 'reads'; stat: string };

/** Whose stat an owner's row reaches: an entity's id, null for the world, undefined for none. */
const reachedOwner = (side: ReturnType<typeof statRowSide>, entityId: string): string | null | undefined =>
  (side === 'own' ? entityId : side === 'global' ? null : undefined);

/** The first trait row that reaches one of `moved` on owner `from` (null = the world). */
function traitReader(world: StatReaderWorld, from: string | null, moved: ReadonlyMap<string, Stat>): { stat: Stat; reader: StatReader } | null {
  const global = new Set(globalStatsOf([...world.stats], world.statGroups).map((s) => s.id));
  const resolved = resolveOwners(world, undefined);
  // Global scope's tree first, with no entity, then each entity owner's.
  for (const owner of [{ entity: null, traits: resolved.global.traits }, ...resolved.owners]) {
    const entity = owner.entity;
    const own = entity ? new Set(resolvedEntityStats(world, entity).map((s) => s.id)) : new Set<string>();
    const reaches = (row: StatChange | TraitStatToggle) => (entity
      ? reachedOwner(statRowSide(row, own, global), entity.id)
      : global.has(row.statId) ? null : undefined);
    for (const trait of owner.traits) {
      const rows = [
        ...trait.statChanges.map((row) => ['change', row] as const),
        ...(trait.statToggles ?? []).map((row) => ['toggle', row] as const),
      ];
      for (const [kind, row] of rows) {
        const stat = moved.get(row.statId);
        if (stat && reaches(row) === from) return { stat, reader: { kind, trait: trait.name } };
      }
    }
  }
  return null;
}

/**
 * The first stat code that reads one of `moved` on owner `from` and would read nothing once it leaves, or a
 * moved stat's own code whose `owner.stats` reads a stat left behind on `from`, or reads any stat when `toWorld`
 * leaves it no owner. Only exact map lookups count. A Blueprint box counts once per owner.
 */
function codeReader(
  world: StatReaderWorld, from: string | null, moved: ReadonlyMap<string, Stat>, toWorld = false,
): { stat: Stat; reader: StatReader } | null {
  const listWorld = {
    scripts: world.scripts, stats: world.stats, statGroups: world.statGroups, traits: world.traits,
    traitGroups: world.traitGroups, entities: world.entities, placeholders: world.placeholders ?? [],
  };
  const owners = statCodeOwners(listWorld);
  const fromOwner = from === null ? owners.world : owners.all.find((owner) => owner.entity?.id === from);
  if (!fromOwner) return null;
  const isMoved = (target: StatTarget) => target.owner === fromOwner && moved.has(target.stat.id);
  // A name one of the moved stats hid answers with the stat that stays.
  const staying = owners.byCodeName(fromOwner.stats.filter((stat) => !moved.has(stat.id)));
  for (const listed of worldScriptList(listWorld, filledScripts, owners)) {
    const { box } = listed;
    const routes = routesIn(box.code);
    // A world script runs once with no owner; its box lists no run.
    const runs: readonly (TraitRun & { self?: Stat })[] = listed.kind === 'world' ? [{ owner: null }] : box.runs;
    const readBy: StatReader = listed.kind === 'stat' ? { kind: 'readBy', stat: listed.box.stat.name }
      : listed.kind === 'trait' ? { kind: 'readByTrait', trait: listed.box.trait.name } : { kind: 'readByWorld' };
    for (const run of routes.length ? runs : []) {
      // A moved stat's own run goes with it, so its `owner` is someone else's afterwards.
      const self = run.self;
      const leaves = !!self && moved.has(self.id) && (run.owner ?? owners.world) === fromOwner;
      for (const { route } of routes) {
        const targets = routeTargets(owners, run, route);
        if (self && leaves && route.root === 'owner') {
          const left = toWorld ? targets[0] : targets.find((target) => !isMoved(target));
          if (left) return { stat: moved.get(self.id) ?? self, reader: { kind: 'reads', stat: left.stat.name } };
          continue;
        }
        const hit = targets.find(isMoved);
        if (!hit || targets.some((target) => !isMoved(target)) || staying.has(route.stat)) continue;
        return { stat: moved.get(hit.stat.id) ?? hit.stat, reader: readBy };
      }
    }
  }
  return null;
}

/** What the move of `moved`, stats of owner `from`, to owner `to` (null = the world) would break: the first
 *  trait row or stat code that reads one of them there. Null when nothing does. */
export function brokenStatReader(
  world: StatReaderWorld, from: string | null, to: string | null, moved: readonly Stat[],
): { stat: Stat; reader: StatReader } | null {
  if (!moved.length) return null;
  const byId = new Map(moved.map((s) => [s.id, s]));
  return traitReader(world, from, byId) ?? codeReader(world, from, byId, to === null);
}

/** What reads one of `moved`, global stats outside Blueprints, as a global stat: the first trait row or stat code
 *  that would stop reading it in Blueprints, where `stats` no longer reaches it. Null when nothing does. */
export function statReaderOutsideBlueprints(world: StatReaderWorld, moved: readonly Stat[]): { stat: Stat; reader: StatReader } | null {
  if (!moved.length) return null;
  const byId = new Map(moved.map((s) => [s.id, s]));
  return traitReader(world, null, byId) ?? codeReader(world, null, byId);
}
