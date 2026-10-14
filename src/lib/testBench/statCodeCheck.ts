/**
 * The Issues instrument's on-demand half: actually running every stat's code in the real sandbox and
 * reporting what came back. On demand rather than live because each stat costs a QuickJS VM, and the badge
 * has to answer instantly on every keystroke.
 *
 * Pure with respect to the world — it marshals a turn-one snapshot, runs it, and returns findings. The rules
 * module owns the rows this raises ({@link STAT_CODE_EXECUTION}, {@link STAT_CODE_UNKNOWN_NAME}), so an
 * execution failure lists, groups and sorts exactly like a static finding.
 */
import { executeStatCode, type SandboxEntity, type StatCodeFailure, type StatCodeResult } from '@/lib/statCodeExecutor';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { statCodeNamed } from '@/lib/statCodeNames';
import { noBoxes, TIMING_LABEL, type CodeBox } from '@/lib/statCodeTiming';
import { statCodeBoxes, statCodeOwners } from '@/lib/statCodeTargets';
import { globalStatsOf, resolvedEntityStats } from '@/lib/statLinks';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from '@/lib/statCodePlaceholders';
import { entityTraitNames, sandboxTraits, unplayedEntities } from '@/lib/statCodeTraits';
import { labelPlaceholders, worldPlacementLetters } from '@/lib/placementLetters';
import { finding, STAT_CODE_EXECUTION, STAT_CODE_UNKNOWN_NAME, type Finding, type FindingItem, type RuleWorld } from './rules';
import { startingGateStats } from '@/lib/gateStats';
import type { Stat } from '@/types';

export { STAT_CODE_EXECUTION, STAT_CODE_UNKNOWN_NAME } from './rules';

/** How a run failed, in the author's words. */
const FAILURE: Record<StatCodeFailure, string> = {
  timeout: 'times out — it never finishes, so the value is left as it was',
  'non-number': 'doesn’t return a number, so the stat keeps its manual value',
  throw: 'throws when it runs, so the stat keeps its manual value',
  'bad-write': 'writes a placeholder or trait a value of the wrong type, so the run changes nothing',
  canceled: 'asked the player and the prompt was closed, so the run changes nothing',
};

/** The stats as turn one hands them to the sandbox: every value seeded at its starting number, so the run
 *  sees the same board the opening turn does rather than a world of zeroes. */
const atStartingValues = (stats: Stat[]): Stat[] => stats.map((stat) => ({
  ...stat,
  value: typeof stat.starting === 'number' ? stat.starting
    : typeof stat.value === 'number' ? stat.value
      : stat.min ?? 0,
}));

const quoteAll = (names: readonly string[]) => names.map((name) => `“${name}”`).join(', ');

/** The names a run wrote that the world lacks, phrased for the row; null when every write landed. */
function unknownNames({ unknownPlaceholders = [], unknownTraits = [] }: StatCodeResult): string | null {
  const parts = [
    ...(unknownPlaceholders.length ? [`no placeholder answers ${quoteAll(unknownPlaceholders)}`] : []),
    ...(unknownTraits.length ? [`no trait is named ${quoteAll(unknownTraits)}`] : []),
  ];
  return parts.length ? parts.join(' and ') : null;
}

/** One box the check runs: the stat whose code it is, the owner it runs for, and how its row names it. */
interface CodedBox {
  stat: Stat;
  box: CodeBox;
  /** Absent for a global stat: `owner` is the empty entry. */
  owner?: SandboxEntity;
  /** The stat, quoted, then its entity for an owned box. */
  name: string;
  item: FindingItem;
}

/**
 * Run each filled box once and report the ones that fail, then the ones whose writes named nothing. A blank
 * box never reaches the sandbox, so a world of plain stats costs nothing. A global stat runs with no owner, an
 * entity's own stat with its entity, and a Blueprint stat once with its group alone as owner (Q10).
 */
export async function checkStatCode(world: RuleWorld): Promise<Finding[]> {
  const statWorld = { stats: world.stats ?? [], statGroups: world.statGroups ?? [] };
  const authoredEntities = world.entities ?? [];
  if ([...statWorld.stats, ...authoredEntities.flatMap((e) => e.stats ?? [])].every(noBoxes)) return [];

  const placeholderDefs = allPlaceholders(world);
  const letters = worldPlacementLetters(world);
  // Under their code names, so the run reaches a stat by the name the rules and the editor name it by.
  const seeded = (stats: readonly Stat[]) => statCodeNamed(atStartingValues([...stats]), placeholderDefs);
  // The row names a stat or entity as the author sees it in the list, not as code reaches it.
  const label = (text: string | undefined) => labelPlaceholders(text ?? '', placeholderDefs, { letters }).trim() || 'Untitled';
  const stats = seeded(globalStatsOf(statWorld.stats, statWorld.statGroups));
  // Turn one has no rolls yet, so an unrolled placeholder reads as a fresh draw; the player holds no traits.
  const placeholders = sandboxPlaceholders({ placeholders: placeholderDefs, owners: placeholderOwners(world), rolls: {} });
  // Stat Conditions read the authored start, as Enter World's do (Q23, Q33).
  const traits = sandboxTraits({
    acquired: [], disabledTraitIds: [], appliedValues: {},
    world: {
      traits: world.traits, groups: world.traitGroups ?? [],
      gateStats: startingGateStats({ stats: world.stats, statGroups: world.statGroups, entities: authoredEntities }),
    },
  }, placeholderDefs);
  // No persona plays, so a write through `persona` names nothing the check can judge. Every entity's stats
  // start at their starting values, and an owned box's `owner` is its entity's own entry.
  const resolved = new Map(authoredEntities.map((entity) => [entity.id, seeded(resolvedEntityStats(statWorld, entity))]));
  const entities: SandboxEntity[] = unplayedEntities(entityTraitNames(
    { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: authoredEntities }, placeholderDefs,
  ), placeholders.owners).map((entity) => ({ ...entity, stats: { stats: resolved.get(entity.id ?? '') ?? [] } }));
  const entryOf = new Map(entities.map((entity) => [entity.id, entity]));
  const dictionaries = sandboxDictionaries(codeDictionaries(world.dictionaries, placeholderDefs), placeholders.owners);

  // One run per filled script, each with its own row naming which it is. A linked stat runs only scripts its
  // link overrides; the Blueprint's own run covers the rest.
  const owners = statCodeOwners({ ...statWorld, entities: authoredEntities, placeholders: placeholderDefs });
  const coded = statCodeBoxes(owners).map((box): CodedBox => {
    const { stat: authored, entity, owner: reads } = box;
    if (entity) {
      const owner = entryOf.get(entity.id);
      const stat = owner?.stats?.stats.find((entry) => entry.id === authored.id) ?? authored;
      const item: FindingItem = { id: entity.id, name: label(entity.name), section: 'entities' };
      return { stat, box, owner, name: `“${label(authored.name)}” of “${item.name}”`, item };
    }
    const row = { name: `“${label(authored.name)}”`, item: { id: authored.id, name: label(authored.name) } };
    if (!reads) return { stat: stats.find((entry) => entry.id === authored.id) ?? authored, box, ...row };
    const group = seeded(reads.stats);
    const own = group.find((entry) => entry.id === authored.id) ?? authored;
    return { stat: own, box, owner: { name: '', traits: [], stats: { stats: group } }, ...row };
  });
  const results = await Promise.all(coded.map(async ({ stat, box, owner, name, item }) => {
    const result = await executeStatCode(box.code, stats, stat, {
      placeholders: placeholders.top, traits, entities, owner, dictionaries,
    });
    const timing = TIMING_LABEL[box.timing];
    if (result.error) {
      return finding(STAT_CODE_EXECUTION, `${timing} code on ${name} ${FAILURE[result.kind ?? 'throw']}`, [item]);
    }
    const unknown = unknownNames(result);
    return unknown
      ? finding(STAT_CODE_UNKNOWN_NAME, `${timing} code on ${name} writes to unknown names. Writes ignored: ${unknown}`, [item])
      : null;
  }));
  return results.filter((found): found is Finding => found !== null);
}
