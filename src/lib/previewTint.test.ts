import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import { toHtml } from 'hast-util-to-html';
import { remarkSubSuper } from './remarkSubSuper';
import { rehypePreviewTint, tintValue, emptyMarker, stripTintSentinels } from './previewTint';

const AMBER = '#fde68a';
const MINT = '#bbf7d0';

// The plugin's job only shows up after a real markdown parse, so these run the same remark stack the
// renderer uses and read the HTML that comes out — never the sentinel encoding or the node shapes.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm, { singleTilde: false })
  .use(remarkBreaks)
  .use(remarkSubSuper)
  .use(remarkRehype)
  .use(rehypePreviewTint);

function render(markdown: string): string {
  return toHtml(processor.runSync(processor.parse(markdown)));
}

// Anything left of a sentinel would render as a hollow box in the pane, so no output may contain one.
function hasSentinel(html: string): boolean {
  return html !== stripTintSentinels(html);
}

describe('preview tint plugin', () => {
  it('wraps a resolved value in a mark carrying the chip color', () => {
    const html = render(`Welcome to ${tintValue('Sedge Landing', AMBER)}.`);
    expect(html).toContain('<mark');
    expect(html).toContain(`background-color:${AMBER}59`);
    expect(html).toContain('Sedge Landing');
    expect(hasSentinel(html)).toBe(false);
  });

  it('gives each chip its own color', () => {
    const html = render(`${tintValue('Mira', AMBER)} and ${tintValue('Sedge', MINT)}`);
    expect(html).toContain(`background-color:${AMBER}59`);
    expect(html).toContain(`background-color:${MINT}59`);
  });

  it('renders markdown inside the value as markdown, still tinted', () => {
    const html = render(`She is ${tintValue('*very* **tired**', AMBER)} today.`);
    expect(html).toMatch(/<mark[^>]*>.*<em>very<\/em>.*<strong>tired<\/strong>.*<\/mark>/s);
  });

  it('keeps a value that parses into several inline nodes inside one mark', () => {
    const html = render(`See ${tintValue('a [link](https://example.com) here', AMBER)}.`);
    expect((html.match(/<mark/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<mark[^>]*>a <a[^>]*>link<\/a> here<\/mark>/);
  });

  it('drops the tint but keeps the text when a value spans a block boundary', () => {
    const html = render(`Intro: ${tintValue('first para\n\nsecond para', AMBER)}`);
    expect(html).not.toContain('<mark');
    expect(html).toContain('first para');
    expect(html).toContain('second para');
    expect(hasSentinel(html)).toBe(false);
  });

  it('leaves a labelled marker where a chip resolved to nothing', () => {
    const html = render(`Notes:${emptyMarker(MINT)} done.`);
    expect(html).toMatch(/<mark[^>]*aria-label="Empty Value"[^>]*><\/mark>/);
    expect(html).toContain(MINT);
    expect(hasSentinel(html)).toBe(false);
  });

  it('renders asterisk emphasis at a value edge, but not underscore emphasis', () => {
    // The documented limit: CommonMark reads a sentinel as an ordinary character, and an underscore run may
    // not open intra-word — so `_word_` at the very start of a value stays literal. `*word*` is unaffected,
    // and underscores anywhere but the value's own edge are fine. Pinned so a codec change can't quietly
    // widen this.
    expect(render(`A ${tintValue('*leaning* text', AMBER)}`)).toContain('<em>leaning</em>');
    const underscored = render(`A ${tintValue('_leaning_ text', AMBER)}`);
    expect(underscored).not.toContain('<em>');
    expect(underscored).toContain('_leaning_ text');
  });

  it('leaves ordinary markdown untouched when no chip resolved', () => {
    expect(render('Plain **prose** with a [link](https://example.com).')).not.toContain('<mark');
  });

  it('strips stray sentinel characters without breaking a real pairing', () => {
    // Author text can't reach here with sentinels in it (the panes scrub them), but a lone one must never
    // swallow the rest of the pane or steal another chip's closer.
    const wrapped = tintValue('x', AMBER);
    const stray = wrapped.slice(-1); // a closer with nothing open
    const orphan = wrapped.charAt(1); // half of a color, with no opener in front of it
    const opener = wrapped.charAt(0); // an opener with prose where its color should be
    const html = render(`${stray}be${orphan}fore ${opener}${tintValue('Mira', AMBER)} after${stray}`);
    expect(html).toMatch(/<mark[^>]*>Mira<\/mark>/);
    // Only the real chip gets a highlight — a stray character must not open or close one of its own.
    expect((html.match(/<mark/g) ?? []).length).toBe(1);
    expect(html).toContain('before');
    expect(html).toContain('after');
    expect(hasSentinel(html)).toBe(false);
  });

  it('strips sentinels inside code instead of tinting through it', () => {
    const html = render(`Type \`${tintValue('npm run dev', AMBER)}\` first.`);
    expect(html).toContain('<code>npm run dev</code>');
    expect(html).not.toContain('<mark');
    expect(hasSentinel(html)).toBe(false);
  });
});

describe('tint codec', () => {
  it('leaves a value alone when the chip has no color to tint with', () => {
    expect(tintValue('Mira', undefined)).toBe('Mira');
    expect(emptyMarker(undefined)).toBe('');
  });

  it('scrubs sentinel characters out of text', () => {
    const wrapped = tintValue('Mira', AMBER);
    expect(stripTintSentinels(wrapped)).toBe('Mira');
    expect(stripTintSentinels('plain')).toBe('plain');
  });
});
