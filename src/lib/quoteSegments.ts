/**
 * Pairs double quotes in a run of text, so quoted speech can be styled apart from narration.
 *
 * `rehypeQuoteSpans` calls this for the markdown path and `choiceRuns` for the choice buttons. Only double
 * quotes pair: an apostrophe is far more often a contraction or a possessive than a quotation mark, and a
 * run opened on one would color the rest of a sentence.
 */

/** One run of text, flagged as quoted speech or as narration around it. Quote marks belong to the run they
 *  open or close, so the marks take the dialogue color too. */
export interface QuoteSegment {
  text: string;
  quoted: boolean;
}

/** A quote's span in the narration and its speaker's entity id, as a Mention Reading gives it. */
export interface SpokenQuote {
  start: number;
  end: number;
  speaker: string | null;
}

/** Each speaker's quote color, by entity id. */
export type SpeakerColors = ReadonlyMap<string, string>;

/** A narration, its reading's quotes (whose spans index into it), and each speaker's color by entity id. */
export interface QuoteSpeakerSource {
  text: string;
  quotes: readonly SpokenQuote[];
  colors: SpeakerColors;
}

/** The spans of `lines` (each a quote and its speaker) found in `text` in order. For canned readings. */
export function spokenQuotes(text: string, lines: readonly (readonly [string, string | null])[]): SpokenQuote[] {
  let from = 0;
  return lines.map(([quote, speaker]) => {
    const start = text.indexOf(quote, from);
    if (start < 0) throw new Error(`No ${quote} after offset ${from}`);
    from = start + quote.length;
    return { start, end: from, speaker };
  });
}

/** One quote's speaker within a rendered block, keyed by its text without markdown syntax. */
export interface BlockQuote {
  key: string;
  speaker: string | null;
}

/** Quote text as the renderer shows it: markdown syntax dropped, whitespace collapsed. */
export const quoteKey = (text: string): string => text.replace(/[*_~=`\\]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The reading's quotes inside one markdown block, in order. The renderer parses each block apart, so the
 * block is found in the narration by its source. A block it cannot place gets no speakers, and so does a
 * block that occurs more than once with different speakers.
 */
export function blockQuotes(source: QuoteSpeakerSource, block: string): BlockQuote[] {
  const body = block.trim();
  if (!body) return [];
  const inBlock = (at: number) => source.quotes
    .filter((quote) => quote.start >= at && quote.end <= at + body.length)
    .map((quote) => ({ key: quoteKey(source.text.slice(quote.start, quote.end)), speaker: quote.speaker }));
  const found: BlockQuote[][] = [];
  for (let at = source.text.indexOf(body); at >= 0; at = source.text.indexOf(body, at + 1)) found.push(inBlock(at));
  const [first, ...rest] = found;
  if (!first) return [];
  const same = (other: BlockQuote[]) => other.length === first.length && other.every((q, i) => q.speaker === first[i].speaker);
  return rest.every(same) ? first : [];
}

/**
 * Give each rendered quote the speaker of the next reading quote with the same text, in order. A rendered
 * quote that a line break cut short (`open`) matches the start of its reading quote. Unmatched runs stay
 * unattributed, so a mismatch costs a color, never a wrong one from a skipped pairing.
 */
export function matchQuoteSpeakers(rendered: readonly { text: string; open: boolean }[], quotes: readonly BlockQuote[]): (string | null)[] {
  let cursor = 0;
  return rendered.map(({ text, open }) => {
    const key = quoteKey(text);
    for (let i = cursor; i < quotes.length; i++) {
      if (quotes[i].key === key || (open && key && quotes[i].key.startsWith(key))) {
        cursor = i + 1;
        return quotes[i].speaker;
      }
    }
    return null;
  });
}

/** The class the dialogue span carries. The one styling hook for quoted speech. */
export const QUOTE_CLASS = 'dialogue-quote';

const CURLY_OPEN = '“';
const CURLY_CLOSE = '”';

/**
 * Split `text` into quoted and plain runs. `startOpen` continues a quote that an earlier run left open,
 * which is how one quote stays a single color across bold and italic. The returned `open` says whether a
 * quote is still standing at the end, for the caller to hand to the next run.
 *
 * A straight `"` toggles, because nothing in it says which end it is. A curly mark says so itself, so `“`
 * only opens and `”` only closes; either one meets the other's partner, since models mix them.
 */
export function segmentQuotes(text: string, startOpen = false): { segments: QuoteSegment[]; open: boolean } {
  const segments: QuoteSegment[] = [];
  let open = startOpen;
  let buffer = '';
  const flush = () => {
    if (buffer) segments.push({ text: buffer, quoted: open });
    buffer = '';
  };

  for (const char of text) {
    const opens = !open && (char === '"' || char === CURLY_OPEN);
    const closes = open && (char === '"' || char === CURLY_CLOSE);
    if (opens) {
      flush();
      open = true;
      buffer = char;
      continue;
    }
    buffer += char;
    if (closes) {
      flush();
      open = false;
    }
  }
  flush();
  return { segments, open };
}

