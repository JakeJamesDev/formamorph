// Learned speaker names: head words a playthrough's quote speaker fixes tie to entities. Derived from the save's
// readings and corrections on every call, so a turn that leaves the history takes what it taught with it.
import type { ChatMessage } from '@/types';
import type { MentionCorrectionMap } from './mentionCorrections';
import { speakerHeadWord, type LearnedNames, type MentionCast, type MentionSceneContext, type QuoteRule } from './mentionReading';
import { narrationHash, turnNarrations, type MentionReadingMap } from './mentionReadings';

// The speech-tag rules and the beat opener; their mention names the speaker.
const TEACHING_RULES: ReadonlySet<QuoteRule> = new Set(['after-subject-verb', 'after-verb-subject', 'before-verb', 'beat']);

/** Each head word the corrections teach, to its entity. A head word two entities claim names nobody. */
export function learnSpeakerNames(
  history: readonly ChatMessage[], readings: MentionReadingMap, corrections: MentionCorrectionMap,
  cast: MentionCast, scene: MentionSceneContext = {},
): LearnedNames {
  const claims = new Map<string, Set<string>>();
  const ids = Object.keys(corrections);
  const narrations = ids.length ? turnNarrations(history) : new Map<string, string>();
  for (const turnId of ids) {
    const { textHash, corrections: turnFixes } = corrections[turnId];
    const entry = readings[turnId];
    const narration = narrations.get(turnId);
    if (!entry?.clusters || !entry.clusterEntities || narration === undefined
      || entry.textHash !== textHash || narrationHash(narration) !== textHash) continue;
    const { clusters, clusterEntities } = entry;
    for (const fix of turnFixes) {
      if (fix.kind !== 'quote' || fix.entityId === null) continue;
      const quote = entry.reading.quotes.find((q) => q.start === fix.start && q.end === fix.end);
      const mention = quote?.mention;
      if (!mention || !quote.rule || !TEACHING_RULES.has(quote.rule)) continue;
      const cluster = clusters.findIndex((c) => c.some(([s, e]) => s === mention.start && e === mention.end));
      if (cluster < 0 || clusterEntities[cluster] !== null) continue;
      const head = speakerHeadWord(narration.slice(mention.start, mention.end), cast, scene);
      if (!head) continue;
      if (!claims.has(head)) claims.set(head, new Set());
      claims.get(head)!.add(fix.entityId);
    }
  }
  const names = new Map<string, string>();
  for (const [head, ids] of claims) if (ids.size === 1) names.set(head, [...ids][0]);
  return names;
}
