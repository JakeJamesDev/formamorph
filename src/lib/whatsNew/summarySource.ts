import { parseReleaseSummary, type ReleaseSummary } from './releaseSummary';

/** Where a Release Summary can come from, in the order the app tries them. */
type SummarySource = 'github' | 'cache' | 'bundled';

export interface SummaryCandidates {
  github: string | null;
  cache: string | null;
  bundled: string | null;
}

const ORDER: readonly SummarySource[] = ['github', 'cache', 'bundled'];

/**
 * The summary What's New can show for `version`, or null. An unmapped emoji is the one error it shows anyway,
 * with the default icon, because a newer release may use an emoji this build's map lacks.
 */
export function renderableSummary(markdown: string, version: string): ReleaseSummary | null {
  const { summary, problems } = parseReleaseSummary(markdown, { version: version.replace(/^v/, '') });
  const blocking = problems.some((p) => p.severity === 'error' && p.code !== 'unmapped-emoji');
  return blocking || summary.version === null ? null : summary;
}

/** The first candidate that renders for `version`, or null when none does. */
export function pickSummary(candidates: SummaryCandidates, version: string): ReleaseSummary | null {
  for (const source of ORDER) {
    const text = candidates[source];
    const summary = text ? renderableSummary(text, version) : null;
    if (summary) return summary;
  }
  return null;
}
