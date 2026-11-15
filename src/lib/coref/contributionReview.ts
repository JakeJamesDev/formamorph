// What staff read on a contributed correction: each changed span with its original and corrected entity.
import type { CorefContribution } from '@/services/CorefContributionService';

/** One correction as the review shows it. Entity ids stay raw: staff have no copy of the world. */
export interface ReviewedCorrection {
  kind: 'mention' | 'quote';
  start: number;
  end: number;
  text: string;
  /** The entity of the original cluster that overlaps the span, or null when none does. Quotes have none. */
  from: string | null;
  to: string | null;
}

/** A run of the passage, marked when a correction covers it. */
export interface PassageRun {
  text: string;
  corrected: boolean;
}

const overlaps = (s: number, e: number, start: number, end: number) => s < end && start < e;

/** The corrections of one contribution, in passage order. */
export function reviewedCorrections(c: Pick<CorefContribution, 'passage' | 'clusters' | 'clusterEntities' | 'corrections'>): ReviewedCorrection[] {
  return c.corrections
    .map(({ kind, start, end, entityId }) => {
      const cluster = kind === 'mention' ? c.clusters.findIndex((spans) => spans.some(([s, e]) => overlaps(s, e, start, end))) : -1;
      return { kind, start, end, text: c.passage.slice(start, end), from: cluster < 0 ? null : c.clusterEntities[cluster], to: entityId };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** The passage split at each corrected span, so the corrected text can be marked. */
export function passageRuns(passage: string, corrections: readonly { start: number; end: number }[]): PassageRun[] {
  const spans = [...corrections].sort((a, b) => a.start - b.start);
  const runs: PassageRun[] = [];
  let at = 0;
  for (const { start, end } of spans) {
    if (end <= at) continue;
    const from = Math.max(start, at);
    if (from > at) runs.push({ text: passage.slice(at, from), corrected: false });
    runs.push({ text: passage.slice(from, end), corrected: true });
    at = end;
  }
  if (at < passage.length) runs.push({ text: passage.slice(at), corrected: false });
  return runs;
}
