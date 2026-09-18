import { segmentQuotes, QUOTE_CLASS } from './quoteSegments';

/**
 * Wraps quoted speech in the markdown renderer in a span the stylesheet can color.
 *
 * It runs last in the renderer's rehype pipeline, after the sanitizer, so it neither relaxes what author
 * markdown may contain nor has its own spans stripped. Only the surfaces that pass the renderer's
 * `dialogue` prop get it.
 *
 * A quote carries across bold, italic and links, because those are inline: one quote stays one color even
 * when emphasis splits it into several text nodes. Each block-level element starts fresh, which is what
 * stops a quote the model never closed at the end of its paragraph. Code is left alone.
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
 *  can produce that is not named here carries a quote rather than cutting it. */
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'figure', 'figcaption', 'hr',
]);

/** Code keeps its quotes as written: a quotation mark there is syntax, not speech. */
const SKIP = new Set(['code', 'pre', 'kbd', 'samp']);

function spanNode(text: string): HastNode {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [QUOTE_CLASS] },
    children: [{ type: 'text', value: text }],
  };
}

/** Rebuild one element's children with quoted runs wrapped. `state` carries an open quote across the
 *  inline elements inside a block. */
function walk(node: HastNode, state: { open: boolean }): void {
  const children = node.children;
  if (!children?.length) return;
  const out: HastNode[] = [];
  for (const child of children) {
    if (child.type === 'text' && child.value !== undefined) {
      const { segments, open } = segmentQuotes(child.value, state.open);
      state.open = open;
      for (const segment of segments) {
        out.push(segment.quoted ? spanNode(segment.text) : { type: 'text', value: segment.text });
      }
      continue;
    }
    out.push(child);
    if (child.type !== 'element') continue;
    const tag = child.tagName ?? '';
    if (SKIP.has(tag)) continue;
    if (BLOCK.has(tag)) walk(child, { open: false });
    else walk(child, state);
  }
  node.children = out;
}

/** Wraps quoted runs in `<span class="dialogue-quote">`. Runs last in the renderer's rehype pipeline, and
 *  only on the surfaces that read as story text. */
export function rehypeQuoteSpans() {
  return (tree: HastNode) => walk(tree, { open: false });
}
