// What reads a trait or trait group from outside Blueprints: the requirements that name it and the stat code that
// reads it by name. A drag into Blueprints that would leave one of them reading nothing is refused (Q81, Q82).

import type { Entity, Placeholder, Stat, StatGroup, Trait, TraitGroup, TraitRequirementRow } from '@/types';
import { canBePlayer } from './owners';
import { statCodeChains } from './statCodeRename';
import { statCodeName } from './statCodeNames';
import { resolvedEntityStats, statBlueprintIds } from './statLinks';

/** What a trait reader reads from a world. The stat lists are absent where no stat code can read the traits. */
export interface TraitReaderWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
  placeholders?: readonly Placeholder[];
}

/** What stops working when a trait or group joins Blueprints. */
export type TraitReader =
  /** A requirement of `trait` names it. An entity's trait reads as `Entity's Trait`. */
  | { kind: 'requires'; trait: string }
  /** The code of `stat` reads it by name. */
  | { kind: 'readBy'; stat: string };

/** The ids a requirement row names. */
const namedIn = (rows: readonly TraitRequirementRow[] | undefined): string[] =>
  (rows ?? []).flatMap((row) => row.all.flatMap((c) => (c.kind === 'trait' || c.kind === 'group' ? [c.id] : [])));

/**
 * The first reader of a trait or group in `moved` as it joins Blueprints from owner `from` (null = the world): a
 * requirement held outside Blueprints, or stat code outside stat Blueprints that reads a moved trait by name.
 * `blueprintIds` are the world traits and groups already inside Blueprints. Readers that move along don't count,
 * and neither do the moved items' own requirements, which read their linkers' sets in Blueprints.
 */
export function traitReaderOutsideBlueprints(
  world: TraitReaderWorld, from: string | null, moved: ReadonlyMap<string, Trait | TraitGroup>, blueprintIds: ReadonlySet<string>,
): { name: string; reader: TraitReader } | null {
  const hit = (rows: readonly TraitRequirementRow[] | undefined, reader: string) => {
    const id = namedIn(rows).find((named) => moved.has(named));
    return id === undefined ? null : { name: moved.get(id)!.name, reader: { kind: 'requires' as const, trait: reader } };
  };
  const worldNames = new Map(world.traits.map((t) => [t.id, t.name]));
  for (const t of world.traits) {
    const found = !moved.has(t.id) && !blueprintIds.has(t.id) && hit(t.requires, t.name);
    if (found) return found;
  }
  for (const e of world.entities) {
    for (const t of e.traits ?? []) {
      const found = !moved.has(t.id) && hit(t.requires, `${e.name}'s ${t.name}`);
      if (found) return found;
    }
    for (const link of e.traitLinks ?? []) {
      for (const [traitId, fields] of Object.entries(link.overrides ?? {})) {
        const found = hit(fields.requires?.value, `${e.name}'s ${worldNames.get(traitId) ?? link.originalName}`);
        if (found) return found;
      }
    }
  }
  return codeReader(world, from, moved, blueprintIds);
}

/** The first stat outside stat Blueprints, or linked from it, whose code reads a moved trait by name where it was:
 *  `traits` and `persona.traits` for the world's, `entities.<owner>.traits` and, while it can be played,
 *  `persona.traits` for an entity's. A name a staying trait still answers keeps reading something. */
function codeReader(
  world: TraitReaderWorld, from: string | null, moved: ReadonlyMap<string, Trait | TraitGroup>, blueprintIds: ReadonlySet<string>,
): { name: string; reader: TraitReader } | null {
  if (!world.stats) return null;
  const codeName = (name: string) => statCodeName(name, world.placeholders ?? []);
  const owner = from === null ? undefined : world.entities.find((e) => e.id === from);
  const ownerTraits = owner ? owner.traits ?? [] : world.traits.filter((t) => !blueprintIds.has(t.id));
  const answered = new Set(ownerTraits.filter((t) => !moved.has(t.id)).map((t) => codeName(t.name)));
  const movedByName = new Map(ownerTraits.filter((t) => moved.has(t.id)).map((t) => [codeName(t.name), t] as const)
    .filter(([name]) => !answered.has(name)));
  if (!movedByName.size) return null;

  const ownerKey = owner && codeName(owner.name);
  const readNames = (stat: Stat): (string | undefined)[] => [
    ...(owner ? [] : statCodeChains(stat, 'traits').map((c) => c[0])),
    ...(!owner || canBePlayer(owner) ? statCodeChains(stat, 'persona').filter(([k]) => k === 'traits').map((c) => c[1]) : []),
    ...(ownerKey ? statCodeChains(stat, 'entities').filter(([k, t]) => k === ownerKey && t === 'traits').map((c) => c[2]) : []),
  ];
  // A Blueprint's code runs on each entity that links it, with that link's overrides.
  const statWorld = { stats: world.stats, statGroups: world.statGroups ?? [] };
  const statBlueprints = statBlueprintIds(statWorld);
  const readers = [...world.stats.filter((s) => !statBlueprints.has(s.id)), ...world.entities.flatMap((e) => resolvedEntityStats(statWorld, e))];
  for (const stat of readers) {
    const target = readNames(stat).map((name) => name && movedByName.get(name)).find(Boolean);
    if (target) return { name: target.name, reader: { kind: 'readBy', stat: stat.name } };
  }
  return null;
}
