/**
 * The Issues instrument's on-demand half: actually running every script in the real sandbox, every timing, and
 * reporting what came back. On demand rather than live because each script costs a QuickJS VM, and the badge
 * has to answer instantly on every keystroke.
 *
 * Pure with respect to the world — it marshals a turn-one snapshot, runs it, and returns findings. The rules
 * module owns the rows this raises ({@link STAT_CODE_EXECUTION}, {@link STAT_CODE_UNKNOWN_NAME}), so an
 * execution failure lists, groups and sorts exactly like a static finding.
 */
import {
  executeStatCode, type SandboxEntity, type SandboxTrait, type StatCodeFailure, type StatCodeResult,
} from '@/lib/statCodeExecutor';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { statCodeBoxes, statCodeOwners, traitCodeBoxes } from '@/lib/statCodeTargets';
import { globalStatsOf, resolvedEntityStats } from '@/lib/statLinks';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from '@/lib/statCodePlaceholders';
import { entityTraitNames, sandboxTraits, unplayedEntities, worldTraitPlaces } from '@/lib/statCodeTraits';
import { labelPlaceholders, worldPlacementLetters } from '@/lib/placementLetters';
import { filledScripts, scriptLabel } from '@/lib/scripts';
import { scriptEntryKey } from '@/lib/worldScripts';
import { SAMPLE_SENTENCE, sampleNarration, sampleSwitchedTrait } from '@/lib/scriptTestSamples';
import type { ScriptPromptHost } from '@/lib/scriptPrompts';
import {
  finding, scriptRef, STAT_CODE_EXECUTION, STAT_CODE_UNKNOWN_NAME, WORLD_SCRIPT_OWNER, type Finding, type FindingItem, type RuleWorld,
} from './rules';
import { startingGateStats } from '@/lib/gateStats';
import type { Script, Stat, Trait } from '@/types';

export { STAT_CODE_EXECUTION, STAT_CODE_UNKNOWN_NAME } from './rules';

/** How a run failed, in the author's words. */
const FAILURE: Record<StatCodeFailure, string> = {
  timeout: 'times out — it never finishes',
  'non-number': 'doesn’t return a number',
  throw: 'throws when it runs',
  'bad-write': 'writes a placeholder or trait a value of the wrong type',
  canceled: 'asked the player and the prompt was closed',
};

/** What a stat script's failure leaves behind. */
const STAT_LEFT: Record<StatCodeFailure, string> = {
  timeout: 'so the value is left as it was',
  'non-number': 'so the stat keeps its manual value',
  throw: 'so the stat keeps its manual value',
  'bad-write': 'so the run changes nothing',
  canceled: 'so the run changes nothing',
};

/** What a failure leaves behind: a During AI Output sentence passes unchanged (Q22); a trait or world script,
 *  which sets no value, changes nothing. */
const leftBehind = (unit: ScriptUnit, kind: StatCodeFailure) => (unit.script.timing === 'output'
  ? 'so its sentence passes unchanged' : unit.kind === 'stat' ? STAT_LEFT[kind] : 'so the run changes nothing');

/** The stats as turn one hands them to the sandbox: every value seeded at its starting number, so the run
 *  sees the same board the opening turn does rather than a world of zeroes. */
const atStartingValues = (stats: Stat[]): Stat[] => stats.map((stat) => ({
  ...stat,
  value: typeof stat.starting === 'number' ? stat.starting
    : typeof stat.value === 'number' ? stat.value
      : stat.min ?? 0,
}));

const quote = (name: string) => `“${name}”`;
const quoteAll = (names: readonly string[]) => names.map(quote).join(', ');

/** The names a run wrote that the world lacks, phrased for the row; null when every write landed. */
function unknownNames({ unknownPlaceholders = [], unknownTraits = [] }: StatCodeResult): string | null {
  const parts = [
    ...(unknownPlaceholders.length ? [`no placeholder answers ${quoteAll(unknownPlaceholders)}`] : []),
    ...(unknownTraits.length ? [`no trait is named ${quoteAll(unknownTraits)}`] : []),
  ];
  return parts.length ? parts.join(' and ') : null;
}

/** One script the check runs, named as its row names it. */
type ScriptUnit = {
  script: Script;
  /** The script by its name or its owner-and-timing fallback, then its owner (Q22, Q49). */
  ref: string;
  item: FindingItem;
  /** The entity an owned script runs under. */
  entityId?: string;
} & (
  | { kind: 'world' }
  /** `group` is a Blueprint stat's group, its `owner.stats`. */
  | { kind: 'stat'; stat: Stat; group?: Stat[] }
  /** `blueprint` marks a Blueprint trait, whose owner is an empty entry. */
  | { kind: 'trait'; trait: Trait; blueprint: boolean }
);


/** Every filled script in the world, in check order: the world's, then each stat's, then each trait's. */
function scriptUnits(world: RuleWorld): ScriptUnit[] {
  const placeholderDefs = allPlaceholders(world);
  const letters = worldPlacementLetters(world);
  // The row names a stat, trait or entity as the author sees it in the list, not as code reaches it.
  const label = (text: string | undefined) => labelPlaceholders(text ?? '', placeholderDefs, { letters }).trim() || 'Untitled';
  const entityOf = (entity: { id: string; name?: string } | null) => (entity
    ? { item: { id: entity.id, name: label(entity.name), section: 'entities' as const }, of: ` of ${quote(label(entity.name))}` }
    : null);

  const worldUnits = filledScripts(world).map((script): ScriptUnit => ({
    kind: 'world', script, ref: scriptRef(script, null),
    // The Scripts tab's row, where a world script is edited.
    item: { id: scriptEntryKey({ kind: 'world' }, script.id), name: scriptLabel(script, WORLD_SCRIPT_OWNER), section: 'scripts' },
  }));
  // A linked stat runs only scripts its link overrides; the Blueprint's own run covers the rest.
  const owners = statCodeOwners({
    stats: world.stats ?? [], statGroups: world.statGroups ?? [], entities: world.entities ?? [], placeholders: placeholderDefs,
  });
  const statUnits = statCodeBoxes(owners).map(({ stat, entity, owner, home, runs, ...script }): ScriptUnit => {
    const on = entityOf(entity);
    const name = label(stat.name);
    return {
      kind: 'stat', script, stat, ref: scriptRef(script, name, on?.of ?? ''),
      item: on?.item ?? { id: stat.id, name },
      ...(entity ? { entityId: entity.id } : owner && { group: owner.stats }),
    };
  });
  // A Blueprint trait's box runs once with an empty owner, as a Blueprint stat's does with its group.
  const traitUnits = traitCodeBoxes(owners, { traits: world.traits ?? [], traitGroups: world.traitGroups ?? [] })
    .map(({ trait, entity, owner, home, runs, ...script }): ScriptUnit => {
      const on = entityOf(entity);
      const name = label(trait.name);
      return {
        kind: 'trait', script, trait, blueprint: !entity && !!owner, ref: scriptRef(script, name, on?.of ?? ''),
        item: on?.item ?? { id: trait.id, name, section: 'traits' },
        ...(entity && { entityId: entity.id }),
      };
    });
  return [...worldUnits, ...statUnits, ...traitUnits];
}

/** How many scripts a check runs. */
export const checkedScriptCount = (world: RuleWorld): number => scriptUnits(world).length;

/**
 * Run each filled script once, in its own timing, and report the ones that fail, then the ones whose writes
 * named nothing. A blank script never reaches the sandbox, so a world of plain stats costs nothing. A global
 * script runs with no owner, an entity's own with its entity, and a Blueprint stat's once with its group alone
 * as owner (Q10). A During AI Output script rewrites a sample sentence and a switch script fires on a sample
 * trait (Q49). `prompts` answers `player.*`.
 */
export async function checkStatCode(world: RuleWorld, prompts?: ScriptPromptHost): Promise<Finding[]> {
  const units = scriptUnits(world);
  if (!units.length) return [];
  const statWorld = { stats: world.stats ?? [], statGroups: world.statGroups ?? [] };
  const authoredEntities = world.entities ?? [];
  const placeholderDefs = allPlaceholders(world);
  // Under their code names, so the run reaches a stat by the name the rules and the editor name it by.
  const seeded = (stats: readonly Stat[]) => statCodeNamed(atStartingValues([...stats]), placeholderDefs);
  const stats = seeded(globalStatsOf(statWorld.stats, statWorld.statGroups));
  // Turn one has no rolls yet, so an unrolled placeholder reads as a fresh draw; the player holds no traits.
  const placeholders = sandboxPlaceholders({ placeholders: placeholderDefs, owners: placeholderOwners(world), rolls: {} });
  // Stat Conditions read the authored start, as Enter World's do (Q23, Q33).
  const traitWorld = { traits: world.traits ?? [], traitGroups: world.traitGroups ?? [] };
  const traits = sandboxTraits({
    acquired: [], disabledTraitIds: [], appliedValues: {},
    world: {
      traits: traitWorld.traits, groups: traitWorld.traitGroups,
      gateStats: startingGateStats({ stats: world.stats, statGroups: world.statGroups, entities: authoredEntities }),
    },
  }, placeholderDefs);
  const firstTraitId = worldTraitPlaces(traitWorld, placeholderDefs)[0]?.id;
  // No persona plays, so a write through `persona` names nothing the check can judge. Every entity's stats
  // start at their starting values, and an owned script's `owner` is its entity's own entry.
  const resolved = new Map(authoredEntities.map((entity) => [entity.id, seeded(resolvedEntityStats(statWorld, entity))]));
  const entities: SandboxEntity[] = unplayedEntities(entityTraitNames(
    { ...traitWorld, entities: authoredEntities }, placeholderDefs,
  ), placeholders.owners).map((entity) => ({ ...entity, stats: { stats: resolved.get(entity.id ?? '') ?? [] } }));
  const entryOf = new Map(entities.map((entity) => [entity.id, entity]));
  const dictionaries = sandboxDictionaries(codeDictionaries(world.dictionaries, placeholderDefs), placeholders.owners);

  const results = await Promise.all(units.map(async (unit) => {
    const { script, ref, item, entityId } = unit;
    const entityOwner = entityId === undefined ? undefined : entryOf.get(entityId);
    const owner: SandboxEntity | undefined = entityOwner
      ?? (unit.kind === 'stat' && unit.group ? { name: '', traits: [], stats: { stats: seeded(unit.group) } } : undefined)
      ?? (unit.kind === 'trait' && unit.blueprint ? { name: '', traits: [] } : undefined);
    const self = unit.kind !== 'stat' ? null
      : (owner?.stats?.stats ?? stats).find((entry) => entry.id === unit.stat.id) ?? unit.stat;
    // A trait's entry as its owner's map holds it; one no map holds reads as not held.
    const selfTrait: SandboxTrait | undefined = unit.kind !== 'trait' ? undefined
      : (owner ? owner.traits : traits).find((entry) => entry.id === unit.trait.id)
        ?? { id: unit.trait.id, name: statCodeName(unit.trait.name, placeholderDefs), enabled: false, acquired: false };
    const result = await executeStatCode(script.code, stats, self, {
      placeholders: placeholders.top, traits, entities, owner, dictionaries,
      ...(selfTrait && { selfTrait }), ...(prompts && { prompts }),
      ...(script.timing === 'output' && { narration: sampleNarration(SAMPLE_SENTENCE) }),
      ...(script.timing === 'switch' && {
        switchedTrait: sampleSwitchedTrait(traits, firstTraitId, selfTrait && { entry: selfTrait, owner: owner?.name ?? '' }),
      }),
    });
    if (result.error) {
      const kind = result.kind ?? 'throw';
      return finding(STAT_CODE_EXECUTION, `${ref} ${FAILURE[kind]}, ${leftBehind(unit, kind)}`, [item]);
    }
    const unknown = unknownNames(result);
    return unknown ? finding(STAT_CODE_UNKNOWN_NAME, `${ref} writes to unknown names. Writes ignored: ${unknown}`, [item]) : null;
  }));
  return results.filter((found): found is Finding => found !== null);
}
