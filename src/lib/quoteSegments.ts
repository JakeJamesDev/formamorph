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

