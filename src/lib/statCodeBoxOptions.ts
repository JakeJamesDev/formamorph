/**
 * What a stat code box reads its code against: the world's names, and one box's analysis options. The stat
 * editor, Test Code, Find All Uses and the help window's code test all build through here, so none of them
 * reads a box another way.
 */

import type { CodeSurface } from './codeSurface';
import type { CodeCardWorld, CodeWorldLookup } from './codeWorldLookup';
import type { PlaceholderOwners } from './placeholderHomes';
import type { CodeEntityNames, CodeOwnerKind, CodePlaceholders, CodeTraitPlace, SurfaceAnalysisOptions } from './statCodeAnalysis';
import { statCodeName, statCodeNamed } from './statCodeNames';
import type { SandboxPlaces } from './statCodeExecutor';
import { codeDictionaries } from './statCodePlaceholders';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { playStatWorld } from './statLinks';
import { entityCodeStats, entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import type { Dictionary, Entity, EntityGroup, GameLocation, Placeholder, Stat, Trait, TraitGroup } from '@/types';

/** The names a run reads and the editor's reader checks, all under their code names. */
export interface StatCodeNames {
  /** The global play stats under their code names: what `stats` keys in every box. */
  codeNamedStats: Stat[];
  statNames: string[];
  placeholders: CodePlaceholders;
  /** The world's traits in Traits-tab order with their group paths. */
  traitPlaces: CodeTraitPlace[];
  traitNames: string[];
  /** The world's traits, for the run's sandbox entries. */
  traits: readonly Trait[];
  /** Every play entity's code name and trait code names. */
  entities: CodeEntityNames[];
  /** Each entity's own stats under their code names, by entity id. */
  entityStats: Readonly<Record<string, readonly Stat[]>>;
  /** The world's locations under their code names, which `location.move` names, standing where a run with no
   *  playthrough stands. Absent ⇒ none. */
  places?: SandboxPlaces;
}

/** The world as play reads it, with links read through their Blueprints. */
export interface StatCodeNameWorld {
  playStats: readonly Stat[];
  playEntities: readonly Entity[];
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entityGroups?: readonly EntityGroup[];
  /** Every placeholder, owned ones included. */
  placeholders: readonly Placeholder[];
  placeholderOwners?: PlaceholderOwners;
  dictionaries?: readonly Dictionary[];
  locations?: readonly Pick<GameLocation, 'id' | 'name' | 'isStarting'>[];
}

/** `locations` under their code names, standing where a run with no playthrough stands: the starting one, else
 *  the first. */
export function codeLocationsOf(
  locations: readonly Pick<GameLocation, 'id' | 'name' | 'isStarting'>[], placeholders: readonly Placeholder[],
): SandboxPlaces {
  const coded = locations.map(({ id, name }) => ({ id, name: statCodeName(name, placeholders) }));
  return { locations: coded, location: coded[Math.max(0, locations.findIndex((location) => location.isStarting))] ?? null };
}

/** The world's names, as every stat code box reads them. */
export function statCodeWorldNames(world: StatCodeNameWorld): StatCodeNames {
  const { placeholders, traits, traitGroups } = world;
  const codeNamedStats = statCodeNamed(world.playStats, placeholders);
  const traitPlaces = worldTraitPlaces({ traits, traitGroups }, placeholders);
  return {
    codeNamedStats,
    statNames: codeNamedStats.map((stat) => stat.name).filter(Boolean),
    placeholders: { list: placeholders, owners: world.placeholderOwners, dictionaries: codeDictionaries(world.dictionaries, placeholders) },
    traitPlaces,
    traitNames: traitPlaces.map((trait) => trait.name),
    traits,
    entities: entityTraitNames({ traits, traitGroups, entities: world.playEntities, entityGroups: world.entityGroups }, placeholders),
    entityStats: entityCodeStats(world.playEntities, placeholders),
    places: codeLocationsOf(world.locations ?? [], placeholders),
  };
}

/** The world's names, as every stat code box of a card world reads them. */
export function cardWorldNames(world: CodeCardWorld): StatCodeNames {
  const play = playStatWorld({ stats: [...world.stats ?? []], statGroups: [...world.statGroups ?? []], entities: [...world.entities] });
  return statCodeWorldNames({ ...world, playStats: play.stats, playEntities: play.entities });
}

/** One box: the stat it belongs to, whose code it holds, and what its cards ask. */
export interface StatBoxSpec {
  /** The box's stat under its code name. */
  selfName?: string;
  /** Absent for a global stat, whose `owner` is empty. Absent `statNames` go unchecked. */
  owner?: { kind: CodeOwnerKind; statNames?: readonly string[] };
  lookup?: CodeWorldLookup;
  /** Absent = stat code's. */
  surface?: CodeSurface;
}

/** The reader's options for one stat code box under the world's `names`. */
export const statBoxAnalysisOptions = (
  { placeholders, traitNames, entities, statNames, places }: Pick<StatCodeNames, 'placeholders' | 'traitNames' | 'entities' | 'statNames' | 'places'>,
  { selfName, owner, lookup, surface = STAT_CODE_SURFACE }: StatBoxSpec = {},
): SurfaceAnalysisOptions => ({
  surface,
  placeholders, traits: traitNames, entities, statNames,
  ...(places && { locations: places.locations.map((location) => location.name) }),
  // A global box's `owner.stats` is empty; an owner given no names leaves them unchecked.
  ...(!owner ? { ownerStatNames: [] } : owner.statNames ? { ownerStatNames: owner.statNames } : {}),
  ...(owner && { owner: owner.kind }), ...(selfName && { selfName }), ...(lookup && { lookup }),
});
