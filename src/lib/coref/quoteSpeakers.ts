import { spanKey, UNCOLORED, type QuoteSpeakerSource, type SpeakerColors } from '@/lib/quoteSegments';
import type { MentionReading } from './mentionReading';
import { turnMentionReading, type MentionReadingMap } from './mentionReadings';
import type { LiveQuotes } from './streamingQuotes';

// One source per color map and reading: the renderer memoizes on its identity.
const sources = new WeakMap<SpeakerColors, WeakMap<MentionReading, QuoteSpeakerSource>>();
const liveSources = new WeakMap<LiveQuotes, WeakMap<SpeakerColors, QuoteSpeakerSource>>();
// Null where the reading colors every early quote the same.
const recolored = new WeakMap<LiveQuotes, WeakMap<SpeakerColors, WeakMap<MentionReading, QuoteSpeakerSource | null>>>();

const cached = <K extends object, V>(map: WeakMap<K, V>, key: K, make: () => V): V => {
  let value = map.get(key);
  if (value === undefined) {
    value = make();
    map.set(key, value);
  }
  return value;
};

/** The quotes read early as a renderer source. It reads `live` at each render, so it keeps one identity while
 *  the reader adds speakers. */
export const liveQuoteSpeakers = (live: LiveQuotes, colors: SpeakerColors): QuoteSpeakerSource =>
  cached(cached(liveSources, live, () => new WeakMap()), colors, () => ({
    get text() { return live.text; },
    get quotes() { return live.quotes; },
    colors,
    subscribe: (listener) => live.subscribe?.(listener) ?? (() => {}),
  }));

/** The color each quote of `early` showed, by span, where `reading` gives that quote another color. */
function recolorOf(early: LiveQuotes, reading: MentionReading, colors: SpeakerColors): Map<string, string> {
  const colorOf = (speaker: string | null) => (speaker ? colors.get(speaker) : undefined);
  const recolor = new Map<string, string>();
  for (const quote of reading.quotes) {
    const before = early.quotes.find((q) => q.start === quote.start && q.end === quote.end);
    if (!before) continue;
    const from = colorOf(before.speaker);
    if (from !== colorOf(quote.speaker)) recolor.set(spanKey(quote), from ?? UNCOLORED);
  }
  return recolor;
}

/** A turn's quote speakers for the renderer, or undefined when the feature is off, the turn has no reading,
 *  or the reading holds no quote. The same reading and colors always give the same object. `early`, the same
 *  narration's quotes read while it streamed, stands in until the reading lands, and then marks each quote the
 *  reading colors differently. */
export function turnQuoteSpeakers(
  enabled: boolean, readings: MentionReadingMap, colors: SpeakerColors, turnId: string | undefined, narration: string,
  early?: LiveQuotes,
): QuoteSpeakerSource | undefined {
  if (!enabled) return undefined;
  const reading = turnMentionReading(readings, turnId, narration);
  if (!reading) return early?.quotes.length ? liveQuoteSpeakers(early, colors) : undefined;
  if (!reading.quotes.length) return undefined;
  if (early) {
    const byReading = cached(cached(recolored, early, () => new WeakMap()), colors, () => new WeakMap());
    const source = cached(byReading, reading, () => {
      const recolor = recolorOf(early, reading, colors);
      return recolor.size ? { text: narration, quotes: reading.quotes, colors, recolor } : null;
    });
    if (source) return source;
  }
  return cached(cached(sources, colors, () => new WeakMap()), reading, () => ({ text: narration, quotes: reading.quotes, colors }));
}
