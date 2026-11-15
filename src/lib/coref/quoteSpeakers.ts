import type { QuoteSpeakerSource, SpeakerColors } from '@/lib/quoteSegments';
import type { MentionReading } from './mentionReading';
import { turnMentionReading, type MentionReadingMap } from './mentionReadings';

// One source per color map and reading: the renderer memoizes on its identity.
const sources = new WeakMap<SpeakerColors, WeakMap<MentionReading, QuoteSpeakerSource>>();

/** A turn's quote speakers for the renderer, or undefined when the feature is off, the turn has no reading,
 *  or the reading names no speaker. The same reading and colors always give the same object. */
export function turnQuoteSpeakers(
  enabled: boolean, readings: MentionReadingMap, colors: SpeakerColors, turnId: string | undefined, narration: string,
): QuoteSpeakerSource | undefined {
  const reading = enabled ? turnMentionReading(readings, turnId, narration) : null;
  if (!reading?.quotes.some((quote) => quote.speaker)) return undefined;
  let byReading = sources.get(colors);
  if (!byReading) {
    byReading = new WeakMap();
    sources.set(colors, byReading);
  }
  let source = byReading.get(reading);
  if (!source) {
    source = { text: narration, quotes: reading.quotes, colors };
    byReading.set(reading, source);
  }
  return source;
}
