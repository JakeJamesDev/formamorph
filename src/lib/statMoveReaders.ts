// What reads a stat on its owner: the trait rows that reach it, as play routes them, and the stat code that names
// it. A move to another owner that would leave one of them pointing at nothing is refused.

import type { Entity, Placeholder, Stat, StatChange, Trait, TraitGroup, TraitStatToggle } from '@/types';
import { canBePlayer, resolveBearers } from './bearers';
import { statCodeChains } from './statCodeRename';
import { statCodeName } from './statCodeNames';
import { playerStatsOf, resolvedEntityStats, type StatLinkWorld } from './statLinks';
import { statRowSide } from './traitTree';

/** What a stat reader reads from a world. */
export interface StatReaderWorld extends StatLinkWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  placeholders?: readonly Placeholder[];
}

/** What breaks when a stat changes owner. `stat` names the stat the move would take away. */
export type StatReader =
  /** A trait's stat change or stat toggle reaches the stat. */
  | { kind: 'change' | 'toggle'; trait: string }
  /** The code of `stat`, which stays or runs elsewhere, reads the stat. */
  | { kind: 'readBy'; stat: string }
  /** The moved stat's own code reads `stat`, which stays. */
  | { kind: 'reads'; stat: string };

/** The owner a bearer's row reaches: an entity's id, null for the world, undefined for none. */
const reachedOwner = (side: ReturnType<typeof statRowSide>, entityId: string): string | null | undefined =>
  (side === 'own' ? entityId : side === 'player' ? null : undefined);

/** The first trait row that reaches one of `moved` on owner `from` (null = the world). */
function traitReader(world: StatReaderWorld, from: string | null, moved: ReadonlyMap<string, Stat>): { stat: Stat; reader: StatReader } | null {
  const player = new Set(playerStatsOf([...world.stats], world.statGroups).map((s) => s.id));
  for (const bearer of resolveBearers(world, undefined).bearers) {
    const entity = bearer.entity;
    const own = entity ? new Set(resolvedEntityStats(world, entity).map((s) => s.id)) : new Set<string>();
    const reaches = (row: StatChange | TraitStatToggle) => (entity
      ? reachedOwner(statRowSide(row, own, player, canBePlayer(entity)), entity.id)
      : player.has(row.statId) ? null : undefined);
    for (const trait of bearer.traits) {
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

/** The first stat code that reads one of `moved` on owner `from`, or, with `ownCode`, that a moved stat runs and
 *  reads a stat left behind. Only exact map lookups count. */
function codeReader(
  world: StatReaderWorld, from: string | null, moved: ReadonlyMap<string, Stat>, ownCode = true,
): { stat: Stat; reader: StatReader } | null {
  const placeholders = world.placeholders ?? [];
  const codeName = (name: string) => statCodeName(name, placeholders);
  const owner = from === null ? undefined : world.entities.find((e) => e.id === from);
  // A Blueprint's code runs on each entity that links it, so the world's `stats` are the player's.
  const ownerStats = owner ? resolvedEntityStats(world, owner) : playerStatsOf([...world.stats], world.statGroups);
  const staying = ownerStats.filter((s) => !moved.has(s.id));
  const stayingByName = new Map(staying.map((s) => [codeName(s.name), s]));
  // A name a staying stat still answers keeps reading something after the move.
  const movedByName = new Map([...moved.values()].map((s) => [codeName(s.name), s] as const).filter(([name]) => !stayingByName.has(name)));

  for (const stat of staying) {
    for (const [name] of statCodeChains(stat, 'stats')) {
      const target = movedByName.get(name);
      if (target) return { stat: target, reader: { kind: 'readBy', stat: stat.name } };
    }
  }
  for (const stat of ownCode ? moved.values() : []) {
    for (const [name] of statCodeChains(stat, 'stats')) {
      const left = movedByName.has(name) ? undefined : stayingByName.get(name);
      if (left) return { stat, reader: { kind: 'reads', stat: left.name } };
    }
  }
  if (!owner) return null;
  // An entity's stats are also read by name through `entities` anywhere, and through `persona` while played.
  const key = codeName(owner.name);
  const everyStat = [...world.stats, ...world.entities.flatMap((e) => resolvedEntityStats(world, e))];
  for (const stat of everyStat) {
    const throughEntities = key ? statCodeChains(stat, 'entities').filter(([k, s]) => k === key && s === 'stats').map((c) => c[2]) : [];
    const throughPersona = canBePlayer(owner) ? statCodeChains(stat, 'persona').filter(([s]) => s === 'stats').map((c) => c[1]) : [];
    for (const name of [...throughEntities, ...throughPersona]) {
      const target = name === undefined ? undefined : movedByName.get(name);
      if (target) return { stat: target, reader: { kind: 'readBy', stat: stat.name } };
    }
  }
  return null;
}

/** What the move of `moved`, stats of owner `from` (null = the world), to another owner would break: the
 *  first trait row or stat code that reads one of them there. Null when nothing does. */
export function brokenStatReader(
  world: StatReaderWorld, from: string | null, moved: readonly Stat[],
): { stat: Stat; reader: StatReader } | null {
  if (!moved.length) return null;
  const byId = new Map(moved.map((s) => [s.id, s]));
  return traitReader(world, from, byId) ?? codeReader(world, from, byId);
}

/** What reads one of `moved`, world stats outside Blueprints, as a player stat: the first trait row or stat code
 *  that would stop reading it in Blueprints. A moved stat's own code reads its linkers' stats there, so it never
 *  counts. Null when nothing does. */
export function statReaderOutsideBlueprints(world: StatReaderWorld, moved: readonly Stat[]): { stat: Stat; reader: StatReader } | null {
  if (!moved.length) return null;
  const byId = new Map(moved.map((s) => [s.id, s]));
  return traitReader(world, null, byId) ?? codeReader(world, null, byId, false);
}
