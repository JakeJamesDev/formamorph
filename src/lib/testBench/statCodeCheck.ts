/**
 * The Issues instrument's on-demand half: actually running every stat's code in the real sandbox and
 * reporting what came back. On demand rather than live because each stat costs a QuickJS VM, and the badge
 * has to answer instantly on every keystroke.
 *
 * Pure with respect to the world — it marshals a turn-one snapshot, runs it, and returns findings. The rules
 * module owns the row this raises ({@link STAT_CODE_EXECUTION}), so an execution failure lists, groups and
 * sorts exactly like a static finding.
 */
import { executeStatCode } from '@/lib/statCodeExecutor';
import { describePlaceholders } from '@/lib/placeholders';
import { STAT_CODE_EXECUTION, type Finding, type RuleWorld } from './rules';
import type { Stat } from '@/types';

export { STAT_CODE_EXECUTION } from './rules';

/** How a run failed, in the author's words. */
const FAILURE: Record<'timeout' | 'non-number' | 'throw', string> = {
  timeout: 'times out — it never finishes, so the value is left as it was',
  'non-number': 'doesn’t return a number, so the stat keeps its manual value',
  throw: 'throws when it runs, so the stat keeps its manual value',
};

/** The stats as turn one hands them to the sandbox: every value seeded at its starting number, so the run
 *  sees the same board the opening turn does rather than a world of zeroes. */
const atStartingValues = (stats: Stat[]): Stat[] => stats.map((stat) => ({
  ...stat,
  value: typeof stat.starting === 'number' ? stat.starting
    : typeof stat.value === 'number' ? stat.value
      : stat.min ?? 0,
}));

/**
 * Run each coded stat once and report the ones that fail. Stats without code never reach the sandbox, so a
 * world of plain stats costs nothing.
 */
export async function checkStatCode(world: RuleWorld): Promise<Finding[]> {
  const stats = atStartingValues(world.stats);
  const coded = stats.filter((stat) => stat.code?.trim());
  const results = await Promise.all(coded.map(async (stat) => {
    const { error, kind } = await executeStatCode(stat.code ?? '', stats, stat);
    if (!error) return null;
    const name = describePlaceholders(stat.name ?? '', world.placeholders).trim() || 'Untitled';
    return {
      ruleId: STAT_CODE_EXECUTION.id,
      severity: STAT_CODE_EXECUTION.severity,
      section: STAT_CODE_EXECUTION.section,
      message: `Code on “${name}” ${FAILURE[kind ?? 'throw']}`,
      items: [{ id: stat.id, name }],
    } satisfies Finding;
  }));
  return results.filter((found): found is Finding => found !== null);
}
