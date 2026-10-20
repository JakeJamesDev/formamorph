/**
 * The Issues instrument's on-demand half: actually running every script in the real sandbox, every timing, and
 * reporting what came back. On demand rather than live because each script costs a QuickJS VM, and the badge
 * has to answer instantly on every keystroke.
 *
 * Pure with respect to the world — it marshals a turn-one snapshot, runs it, and returns findings. The rules
 * module owns the rows this raises ({@link SCRIPT_EXECUTION}, {@link SCRIPT_UNKNOWN_NAME}), so an
 * execution failure lists, groups and sorts exactly like a static finding.
 */
import {
  executeStatCode, type SandboxEntity, type SandboxTrait, type StatCodeFailure, type StatCodeResult,
} from '@/lib/statCodeExecutor';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { globalStatsOf, resolvedEntityStats } from '@/lib/statLinks';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from '@/lib/statCodePlaceholders';
import { entityTraitNames, sandboxTraits, unplayedEntities, worldTraitPlaces } from '@/lib/statCodeTraits';
import { SAMPLE_SENTENCE, sampleNarration, sampleSwitchedTrait } from '@/lib/scriptTestSamples';
import { askedBy, type ScriptPromptHost } from '@/lib/scriptPrompts';
import {
  ruleScripts, scriptFinding, SCRIPT_EXECUTION, SCRIPT_UNKNOWN_NAME, type Finding, type FindingItem, type RuleWorld,
} from './rules';
import { startingGateStats } from '@/lib/gateStats';
import { atStartValues } from '@/lib/statDescriptorGeometry';
import { codeLocationsOf } from '@/lib/statCodeBoxOptions';
import type { Script, Stat, Trait } from '@/types';

export { SCRIPT_EXECUTION, SCRIPT_UNKNOWN_NAME } from './rules';

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
  /** The script's display name, shown beside its prompts (Q9). */
  label: string;
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


/** Every filled script in the world, in check order: the world's, then each stat's, then each trait's. A linked
 *  stat runs only scripts its link overrides; a Blueprint stat's box runs once with its group as owner, and a
 *  Blueprint trait's once with an empty owner. */
const scriptUnits = (world: RuleWorld): ScriptUnit[] => ruleScripts(world).map(({ listed, ref, label, item }): ScriptUnit => {
  if (listed.kind === 'world') {
    const { home, owner, runs, ...script } = listed.box;
    return { kind: 'world', script, ref, label, item };
  }
  if (listed.kind === 'stat') {
    const { stat, entity, owner, home, runs, ...script } = listed.box;
    return { kind: 'stat', script, stat, ref, label, item, ...(entity ? { entityId: entity.id } : owner && { group: owner.stats }) };
  }
  const { trait, entity, owner, home, runs, ...script } = listed.box;
  return { kind: 'trait', script, trait, blueprint: !entity && !!owner, ref, label, item, ...(entity && { entityId: entity.id }) };
});

/** How many scripts a check runs. */
export const checkedScriptCount = (world: RuleWorld): number => scriptUnits(world).length;

/**
 * Run each filled script once, in its own timing, and report the ones that fail, then the ones whose writes
 * named nothing. A blank script never reaches the sandbox, so a world of plain stats costs nothing. A global
 * script runs with no owner, an entity's own with its entity, and a Blueprint stat's once with its group alone
 * as owner (Q10). A During AI Output script rewrites a sample sentence and a switch script fires on a sample
 * trait (Q49). `prompts` answers `player.*`.
 */
export async function checkScripts(world: RuleWorld, prompts?: ScriptPromptHost): Promise<Finding[]> {
  const units = scriptUnits(world);
  if (!units.length) return [];
  const statWorld = { stats: world.stats ?? [], statGroups: world.statGroups ?? [] };
  const authoredEntities = world.entities ?? [];
  const placeholderDefs = allPlaceholders(world);
  // Under their code names, so the run reaches a stat by the name the rules and the editor name it by.
  const seeded = (stats: readonly Stat[]) => statCodeNamed(atStartValues(stats), placeholderDefs);
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
  const places = codeLocationsOf(world.locations ?? [], placeholderDefs);

  const results = await Promise.all(units.map(async (unit) => {
    const { script, ref, label, item, entityId } = unit;
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
      placeholders: placeholders.top, traits, entities, owner, dictionaries, places,
      ...(selfTrait && { selfTrait }), ...(prompts && { prompts: askedBy(prompts, label) }),
      ...(script.timing === 'output' && { narration: sampleNarration(SAMPLE_SENTENCE) }),
      ...(script.timing === 'switch' && {
        switchedTrait: sampleSwitchedTrait(traits, firstTraitId, selfTrait && { entry: selfTrait, owner: owner?.name ?? '' }),
      }),
    });
    if (result.error) {
      const kind = result.kind ?? 'throw';
      return scriptFinding(SCRIPT_EXECUTION, `${ref} ${FAILURE[kind]}, ${leftBehind(unit, kind)}`, item);
    }
    const unknown = unknownNames(result);
    return unknown ? scriptFinding(SCRIPT_UNKNOWN_NAME, `${ref} writes to unknown names. Writes ignored: ${unknown}`, item) : null;
  }));
  return results.filter((found): found is Finding => found !== null);
}
