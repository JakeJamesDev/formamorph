import { segmentQuotes, QUOTE_CLASS, blockQuotes, matchQuotes, spanKey, type QuoteSpeakerSource } from './quoteSegments';

export type { QuoteSpeakerSource };

/**
 * Wraps quoted speech in the markdown renderer in a span the stylesheet can color.
 *
 * It runs last in the renderer's rehype pipeline, after the sanitizer, so it neither relaxes what author
 * markdown may contain nor has its own spans stripped. Only the surfaces that pass the renderer's
 * `dialogue` prop get it.
 *
 * A quote carries across bold, italic and links, because those are inline: one quote stays one color even
 * when emphasis splits it into several text nodes. Each block-level element starts fresh, and so does each
 * line break, which is what stops a quote the model never closed at the end of its line. Code is left
 * alone.
 *
 * With `speakers`, every quote the turn's Mention Reading holds carries its span in the narration as
 * `data-quote-span="<start>:<end>"`, and one with a colored speaker carries that speaker's id and color.
 */

/** The hast subset this walks. Only the fields actually read are declared (see remarkSubSuper). */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Elements that end a quote at their boundary. Everything else counts as inline, so an element markdown
 *  can produce that is not named here carries a quote rather than cutting it.
 *  `br` is here although it is inline: `remarkBreaks` turns every single newline into one, and a model
 *  that drops a closing mark would otherwise color every line after it down to the blank line. */
const ENDS_QUOTE = new Set([
  'br',
  'p', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'figure', 'figcaption', 'hr',
]);

/** Code keeps its quotes as written: a quotation mark there is syntax, not speech. */
const SKIP = new Set(['code', 'pre', 'kbd', 'samp']);

/** One rendered quote: its spans (emphasis can split it), its text, and whether it ran out unclosed. */
interface QuoteRun {
  spans: HastNode[];
  text: string;
  open: boolean;
}

interface WalkState {
  open: boolean;
  run: QuoteRun | null;
}

function spanNode(text: string): HastNode {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [QUOTE_CLASS] },
    children: [{ type: 'text', value: text }],
  };
}

/** Rebuild one element's children with quoted runs wrapped. `state` carries an open quote across the
 *  inline elements inside a block; `runs` collects every quote in document order. */
function walk(node: HastNode, state: WalkState, runs: QuoteRun[]): void {
  const children = node.children;
  if (!children?.length) return;
  const out: HastNode[] = [];
  for (const child of children) {
    if (child.type === 'text' && child.value !== undefined) {
      const { segments, open } = segmentQuotes(child.value, state.open);
      state.open = open;
      segments.forEach((segment, i) => {
        if (!segment.quoted) { out.push({ type: 'text', value: segment.text }); return; }
        const span = spanNode(segment.text);
        out.push(span);
        if (!state.run) { state.run = { spans: [], text: '', open: true }; runs.push(state.run); }
        state.run.spans.push(span);
        state.run.text += segment.text;
        // A quoted segment closes its quote unless it is the last one and the quote is still standing.
        if (i < segments.length - 1 || !open) { state.run.open = false; state.run = null; }
      });
      continue;
    }
    out.push(child);
    if (child.type !== 'element') continue;
    const tag = child.tagName ?? '';
    if (SKIP.has(tag)) continue;
    if (!ENDS_QUOTE.has(tag)) { walk(child, state, runs); continue; }
    // The element ends the run it sits in and starts its own, so a `<br>` cuts the quote even though it
    // holds nothing, and a block nested in a block does not leak a quote back out.
    state.open = false;
    state.run = null;
    walk(child, { open: false, run: null }, runs);
  }
  node.children = out;
}

/** Wraps quoted runs in `<span class="dialogue-quote">`. Runs last in the renderer's rehype pipeline, and
 *  only on the surfaces that read as story text. */
export function rehypeQuoteSpans(options?: { speakers?: QuoteSpeakerSource }) {
  const speakers = options?.speakers;
  return (tree: HastNode, file?: { value?: unknown }) => {
    const runs: QuoteRun[] = [];
    walk(tree, { open: false, run: null }, runs);
    if (!speakers || !runs.length) return;
    const quotes = blockQuotes(speakers, String(file?.value ?? ''));
    matchQuotes(runs, quotes).forEach((quote, i) => {
      if (!quote) return;
      // A speaker without a color (unresolved, unnamed, or gone from the cast) keeps only its span, so it can be corrected.
      const color = quote.speaker ? speakers.colors.get(quote.speaker) : undefined;
      const from = speakers.recolor?.get(spanKey(quote));
      const styles = [color && `--quote-speaker: ${color}`, from && `--quote-from: ${from}`].filter(Boolean).join('; ');
      const mark = {
        ...(color && quote.speaker ? { dataSpeaker: quote.speaker } : {}),
        ...(styles ? { style: styles } : {}),
        ...(from ? { dataQuoteRecolor: '' } : {}),
      };
      for (const span of runs[i].spans) span.properties = { ...span.properties, dataQuoteSpan: spanKey(quote), ...mark };
    });
  };
}
