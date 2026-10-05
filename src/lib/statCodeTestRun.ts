/**
 * One Test Code run: a stat box's code run once on the authored world, with no playthrough. The editor's
 * Test Code button and Formaquestion's code test both run through here, so both report the same writes.
 */
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { codePinText } from '@/lib/placeholderPins';
import { CODE_BOUND_FIELDS, entityTraitsPath, executeStatCode, type CodeBoundField } from '@/lib/statCodeExecutor';
import type { AnalysisOptions, CodeEntityNames, CodePlaceholders } from '@/lib/statCodeAnalysis';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from '@/lib/statCodePlaceholders';
import { placeholderPathLabel } from '@/lib/statCodePaths';
import type { StatCodeTiming } from '@/lib/statCodeTiming';
import { entityTraitNames, sandboxTraits, unplayedEntities } from '@/lib/statCodeTraits';
import type { Stat, Trait, World } from '@/types';

/** Test Code names each bound a run wrote with its Details field label. */
const BOUND_LABELS: Record<CodeBoundField, string> = { min: 'Min', max: 'Max', regen: 'Regen' };

/** The clock each box reads under Test Code: the turn start the before box gets, a one-hour turn for the
 *  after box. Zero elapsed puts the before run on the opening turn, which its templates are written for. */
const TEST_CLOCK: Record<StatCodeTiming, { deltaHours: number; elapsedHours: number }> = {
  before: { deltaHours: 0, elapsedHours: 0 },
  after: { deltaHours: 1, elapsedHours: 1 },
};

/** The names a run reads and the editor's reader checks, all under their code names. */
export interface StatCodeNames {
  /** The world's stats under their code names. */
  codeNamedStats: Stat[];
  statNames: string[];
  placeholders: CodePlaceholders;
  traitNames: string[];
  /** The world's traits, for the run's sandbox entries. */
  traits: readonly Trait[];
  /** Every authored entity's code name and trait code names. */
  entities: CodeEntityNames[];
}

/** The parts of an authored world a stat's code reaches. */
export type StatCodeWorld = Pick<World, 'stats' | 'traits' | 'traitGroups' | 'entities' | 'entityGroups' | 'placeholders' | 'placeholderGroups' | 'dictionaries'>;

/** The names of `world` as the stat panel reads them. */
export function statCodeNames(world: StatCodeWorld): StatCodeNames {
  const list = allPlaceholders(world);
  const codeNamedStats = statCodeNamed(world.stats, list);
  return {
    codeNamedStats,
    statNames: codeNamedStats.map((stat) => stat.name).filter(Boolean),
    placeholders: { list, owners: placeholderOwners(world), dictionaries: codeDictionaries(world.dictionaries, list) },
    traitNames: statCodeNamed(world.traits, list).map((trait) => trait.name),
    traits: world.traits,
    entities: entityTraitNames({ ...world, traitGroups: world.traitGroups ?? [] }, list),
  };
}

/** The editor reader's options for code of the stat `selfName` names, under `names`. */
export const analysisOptionsOf = (
  { placeholders, traitNames, entities, statNames }: Pick<StatCodeNames, 'placeholders' | 'traitNames' | 'entities' | 'statNames'>, selfName?: string,
): AnalysisOptions =>
  ({ placeholders, traits: traitNames, entities, statNames, ...(selfName && { selfName }) });

/** The stat of `world` that code names `name`: by code name first, then by authored name. */
export function statNamed(world: StatCodeWorld, name: string): Stat | undefined {
  const list = allPlaceholders(world);
  return world.stats.find((stat) => statCodeName(stat.name, list) === name) ?? world.stats.find((stat) => stat.name === name);
}

/** What one run did. */
export interface TestCodeReport {
  /** Why the run failed; every write is then dropped. Null when it ran. */
  error: string | null;
  /** The value the code set, by return or by `self.value`; null when it left the value alone. */
  value: number | null;
  /** Each bound, placeholder and trait switch the run wrote, as one line each. */
  writes: string[];
  /** Each kind of write the run dropped, as one line each with the names. */
  dropped: string[];
}

/** Runs `code` from the `timing` box of `stat`, whose name is its code name. Applies nothing. */
export async function runTestCode(
  code: string, timing: StatCodeTiming, stat: Partial<Stat> & Pick<Stat, 'id' | 'name'>,
  { codeNamedStats, placeholders, traits, entities }: Pick<StatCodeNames, 'codeNamedStats' | 'placeholders' | 'traits' | 'entities'>,
): Promise<TestCodeReport> {
  // No playthrough: an unrolled placeholder reads as a fresh draw, no one holds a trait, and no persona plays.
  const placeholderEntries = sandboxPlaceholders({ placeholders: placeholders.list, owners: placeholders.owners, rolls: {} });
  const owners = placeholderEntries.owners;
  const traitEntries = sandboxTraits(
    { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [...traits], groups: [] } },
    placeholders.list,
  );
  const outcome = await executeStatCode(
    // A half-filled stat still runs: the executor defaults every number it marshals, so only the id and the
    // code name have to be real.
    code, codeNamedStats, stat as Stat,
    {
      clock: TEST_CLOCK[timing], placeholders: placeholderEntries.top, traits: traitEntries,
      entities: unplayedEntities(entities, owners),
      dictionaries: sandboxDictionaries(placeholders.dictionaries ?? [], owners),
    },
  );
  if (outcome.error) return { error: outcome.error, value: null, writes: [], dropped: [] };
  const writes = [
    ...CODE_BOUND_FIELDS.flatMap((field) => {
      const bound = outcome.bounds?.[field];
      return bound === undefined ? [] : [`${BOUND_LABELS[field]}: ${bound}`];
    }),
    ...(outcome.placeholders ?? []).map((entry) => {
      // The path the code wrote, not the placeholder's bare name: that is what the author typed.
      const at = placeholderPathLabel(entry.path);
      return 'unpin' in entry ? `${at} unpinned` : `${at} = ${codePinText(entry.value)}`;
    }),
    ...(outcome.traits ?? []).map((entry) => `${entry.name} switched ${entry.enabled ? 'on' : 'off'}`),
    ...(outcome.entities ?? []).flatMap(({ entity, traits: switched = [] }) =>
      switched.map((entry) => `${entityTraitsPath(entity)}.${entry.name} switched ${entry.enabled ? 'on' : 'off'}`)),
  ];
  const dropped = [
    ...(outcome.unknownPlaceholders ? [`Unknown placeholder paths. Writes ignored: ${outcome.unknownPlaceholders.join(', ')}.`] : []),
    ...(outcome.unknownOwnerPlaceholders ? [`Placeholders of owners not in play. Writes ignored: ${outcome.unknownOwnerPlaceholders.join(', ')}.`] : []),
    ...(outcome.unknownTraits ? [`Unknown trait names. Writes ignored: ${outcome.unknownTraits.join(', ')}.`] : []),
    ...(outcome.acquiredWrites ? [`acquired is read-only. Writes ignored: ${outcome.acquiredWrites.join(', ')}.`] : []),
    ...(outcome.unknownEntities ? [`Unknown entity names. Writes ignored: ${outcome.unknownEntities.join(', ')}.`] : []),
    ...(outcome.readOnlyWrites ? [`Read-only fields. Writes ignored: ${outcome.readOnlyWrites.join(', ')}.`] : []),
    ...(outcome.entities ?? []).flatMap(({ entity, unknownTraits, acquiredWrites }) => {
      const at = (names: string[]) => names.map((name) => `${entityTraitsPath(entity)}.${name}`).join(', ');
      return [
        ...(unknownTraits ? [`Unknown trait names. Writes ignored: ${at(unknownTraits)}.`] : []),
        ...(acquiredWrites ? [`acquired is read-only. Writes ignored: ${at(acquiredWrites)}.`] : []),
      ];
    }),
  ];
  return { error: null, value: outcome.value, writes, dropped };
}
