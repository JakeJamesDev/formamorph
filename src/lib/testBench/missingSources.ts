/**
 * The Issues instrument's missing-source findings: one row per world copy whose source check failed, raised
 * from the answers the on-demand check collected rather than from the live pass, which reads no network.
 * The rules module owns the two rows this raises ({@link SOURCE_NOT_FOUND} and {@link SOURCE_UNAVAILABLE}),
 * so they group, sort, and dismiss exactly like a static finding.
 */
import { missingSources, type MissingSource, type SourceCopy, type SourceCheckResults } from '@/lib/sourceChecks';
import { finding, SOURCE_NOT_FOUND, SOURCE_UNAVAILABLE, type Finding, type FindingItem } from './rules';

/** The copy as a finding names it, on the editor tab that lists it. */
const asItem = (row: MissingSource): FindingItem => ({
  id: row.id,
  name: row.name,
  section: row.kind === 'dictionary' ? 'dictionary' : 'entities',
});

/** What one removed source costs the world: a required one stops a new game, an optional one nothing. */
const removedMessage = (row: MissingSource): string =>
  row.required
    ? `“${row.sourceName}” was removed by its author, and this world requires it`
    : `“${row.sourceName}” was removed by its author`;

/**
 * One finding per copy whose source the check could not confirm.
 *
 * @param copies - The world's linked copies
 * @param results - What the check said about each source
 * @returns The findings, removed sources before unreachable ones
 */
export function checkMissingSources(
  copies: readonly SourceCopy[], results: SourceCheckResults,
): Finding[] {
  const rows = missingSources(copies, results);
  return [
    ...rows.filter((row) => row.status === 'not_found')
      .map((row) => finding(SOURCE_NOT_FOUND, removedMessage(row), [asItem(row)])),
    ...rows.filter((row) => row.status === 'unavailable')
      .map((row) => finding(
        SOURCE_UNAVAILABLE, `Formamorph could not check “${row.sourceName}”`, [asItem(row)],
      )),
  ];
}

/** Whether a row in the Issues list is one of the two missing-source rows, which draw their own repairs. */
export function isSourceRule(ruleId: string): boolean {
  return ruleId === SOURCE_NOT_FOUND.id || ruleId === SOURCE_UNAVAILABLE.id;
}
