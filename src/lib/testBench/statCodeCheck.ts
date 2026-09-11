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
import { allPlaceholders } from '@/lib/placeholderHomes';
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
    ...(unknownPlaceholders.length ? [`no placeholder is named ${quoteAll(unknownPlaceholders)}`] : []),
    ...(unknownTraits.length ? [`no trait is named ${quoteAll(unknownTraits)}`] : []),
  ];
  return parts.length ? parts.join(' and ') : null;
}

/**
 * Run each coded stat once and report the ones that fail, then the ones whose writes named nothing. Stats
 * without code never reach the sandbox, so a world of plain stats costs nothing.
 */
export async function checkStatCode(world: RuleWorld): Promise<Finding[]> {
  const stats = atStartingValues(world.stats);
  const coded = stats.filter((stat) => stat.code?.trim());
  const letters = worldPlacementLetters(world);
  // Turn one has no rolls yet, so an unrolled placeholder reads as a fresh draw; the player holds no traits.
  const placeholders = coded.length ? sandboxPlaceholders({ placeholders: allPlaceholders(world), rolls: {} }) : [];
  const traits = coded.length ? sandboxTraits({
    acquired: [], disabledTraitIds: [], appliedValues: {},
    world: { traits: world.traits, groups: world.traitGroups ?? [] },
  }) : [];
  const results = await Promise.all(coded.map(async (stat) => {
    const result = await executeStatCode(stat.code ?? '', stats, stat, { placeholders, traits });
    const name = labelPlaceholders(stat.name ?? '', allPlaceholders(world), { letters }).trim() || 'Untitled';
    const item = [{ id: stat.id, name }];
    if (result.error) return finding(STAT_CODE_EXECUTION, `Code on “${name}” ${FAILURE[result.kind ?? 'throw']}`, item);
    const unknown = unknownNames(result);
    return unknown ? finding(STAT_CODE_UNKNOWN_NAME, `Code on “${name}” writes to names the world doesn’t have: ${unknown}`, item) : null;
  }));
  return results.filter((found): found is Finding => found !== null);
}
