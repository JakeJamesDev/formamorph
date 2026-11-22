// What staff read on a contributed correction: each changed span with its original and corrected entity.
import type { CorefContribution } from '@/services/CorefContributionService';
import type { MentionCorrection } from './mentionCorrections';

/** One correction as the review shows it, by entity id. */
export interface ReviewedCorrection {
  kind: MentionCorrection['kind'];
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

/** The name a contribution sent for an entity, else its id: staff have no copy of the world (Q71). */
export const entityLabel = (names: Readonly<Record<string, string>>, id: string): string =>
  (Object.hasOwn(names, id) ? names[id] : id);

const overlaps = (s: number, e: number, start: number, end: number) => s < end && start < e;

/** The corrections of one contribution, in passage order. */
export function reviewedCorrections(c: Pick<CorefContribution, 'passage' | 'clusters' | 'clusterEntities' | 'corrections'>): ReviewedCorrection[] {
  return c.corrections
    .map(({ kind, start, end, entityId }) => {
      const cluster = kind !== 'quote' ? c.clusters.findIndex((spans) => spans.some(([s, e]) => overlaps(s, e, start, end))) : -1;
      return { kind, start, end, text: c.passage.slice(start, end), from: cluster < 0 ? null : c.clusterEntities[cluster], to: entityId };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

const RULE_LABELS: Readonly<Record<string, string>> = {
  'after-subject-verb': 'Speech tag, name then verb',
  'after-verb-subject': 'Speech tag, verb then name',
  'before-verb': 'Speech tag before the quote',
  beat: 'Action beat',
  'nearest-subject': 'Nearest subject',
  'own-first-person': 'Quote’s own “I”',
  'earlier-quote': 'Earlier quote',
  'pronoun-subject': 'Pronoun subject',
  'named-subject': 'Named subject',
  none: 'No rule',
};

/** Staff wording for a rule slug; a slug from a newer client shows as sent. */
export const ruleLabel = (rule: string): string => (Object.hasOwn(RULE_LABELS, rule) ? RULE_LABELS[rule] : rule);

/** What the player saw for a quote: the record at that exact span, or null for an older row or no match. */
export function shownQuote(c: Pick<CorefContribution, 'quotes'>, start: number, end: number): { speakerId: string | null; rule: string } | null {
  const record = c.quotes?.find((q) => q.start === start && q.end === end);
  return record ? { speakerId: record.speakerId, rule: record.rule } : null;
}

/** One label the export derives from a quote fix, with its passage text. */
export interface DerivedLabelRow {
  start: number;
  end: number;
  text: string;
  entityId: string;
  wholeCluster: boolean;
}

/** The derived labels of one contribution, in passage order; empty for a row without them. */
export function derivedLabelRows(c: Pick<CorefContribution, 'passage' | 'derivedLabels'>): DerivedLabelRow[] {
  return [...(c.derivedLabels ?? [])]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((d) => ({ ...d, text: c.passage.slice(d.start, d.end) }));
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
