/**
 * The Issues instrument's on-demand half: actually running every stat's code in the real sandbox and
 * reporting what came back. On demand rather than live because each stat costs a QuickJS VM, and the badge
 * has to answer instantly on every keystroke.
 *
 * Pure with respect to the world — it marshals a turn-one snapshot, runs it, and returns findings. The rules
 * module owns the rows this raises ({@link STAT_CODE_EXECUTION}, {@link STAT_CODE_UNKNOWN_NAME}), so an
 * execution failure lists, groups and sorts exactly like a static finding.
 */
import { executeStatCode, type StatCodeFailure, type StatCodeResult } from '@/lib/statCodeExecutor';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { statCodeNamed } from '@/lib/statCodeNames';
import { filledCodeBoxes, TIMING_LABEL } from '@/lib/statCodeTiming';
import { sandboxPlaceholders } from '@/lib/statCodePlaceholders';
import { sandboxTraits } from '@/lib/statCodeTraits';
import { labelPlaceholders, worldPlacementLetters } from '@/lib/placementLetters';
import { finding, STAT_CODE_EXECUTION, STAT_CODE_UNKNOWN_NAME, type Finding, type RuleWorld } from './rules';
import type { Stat } from '@/types';

export { STAT_CODE_EXECUTION, STAT_CODE_UNKNOWN_NAME } from './rules';

/** How a run failed, in the author's words. */
const FAILURE: Record<StatCodeFailure, string> = {
  timeout: 'times out — it never finishes, so the value is left as it was',
  'non-number': 'doesn’t return a number, so the stat keeps its manual value',
  throw: 'throws when it runs, so the stat keeps its manual value',
  'bad-write': 'writes a placeholder or trait a value of the wrong type, so the run changes nothing',
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

/**
 * Run each filled box once and report the ones that fail, then the ones whose writes named nothing. A blank
 * box never reaches the sandbox, so a world of plain stats costs nothing.
 */
export async function checkStatCode(world: RuleWorld): Promise<Finding[]> {
  const placeholderDefs = allPlaceholders(world);
  // Under their code names, so the run reaches a stat by the name the rules and the editor name it by.
  const stats = statCodeNamed(atStartingValues(world.stats), placeholderDefs);
  // One run per filled box: the two hold different code, so each gets its own row naming which it is.
  const coded = stats.flatMap((stat) => filledCodeBoxes(stat).map((box) => ({ stat, box })));
  const letters = worldPlacementLetters(world);
  // Turn one has no rolls yet, so an unrolled placeholder reads as a fresh draw; the player holds no traits.
  const placeholders = coded.length
    ? sandboxPlaceholders({ placeholders: placeholderDefs, owners: placeholderOwners(world), rolls: {} })
    : [];
  const traits = coded.length ? sandboxTraits({
    acquired: [], disabledTraitIds: [], appliedValues: {},
    world: { traits: world.traits, groups: world.traitGroups ?? [] },
  }, placeholderDefs) : [];
  const results = await Promise.all(coded.map(async ({ stat, box }) => {
    const result = await executeStatCode(box.code, stats, stat, { placeholders, traits });
    const label = TIMING_LABEL[box.timing];
    // The row names the stat as the author sees it in the list, not as code reaches it.
    const authored = world.stats?.find((entry) => entry.id === stat.id)?.name ?? stat.name;
    const name = labelPlaceholders(authored ?? '', placeholderDefs, { letters }).trim() || 'Untitled';
    const item = [{ id: stat.id, name }];
    if (result.error) {
      return finding(STAT_CODE_EXECUTION, `${label} code on “${name}” ${FAILURE[result.kind ?? 'throw']}`, item);
    }
    const unknown = unknownNames(result);
    return unknown
      ? finding(STAT_CODE_UNKNOWN_NAME, `${label} code on “${name}” writes to unknown names. Writes ignored: ${unknown}`, item)
      : null;
  }));
  return results.filter((found): found is Finding => found !== null);
}
