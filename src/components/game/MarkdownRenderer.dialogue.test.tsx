import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { QUOTE_CLASS } from '@/lib/quoteSegments';

// The segmenter has its own unit tests. These run the real component, because what matters here is what
// survives the whole pipeline: the parse, the sanitizer, and the plugin that runs after it. So they read
// the DOM that comes out, never the plugin's node shapes.

function quotes(markdown: string, dialogue = true): HTMLElement[] {
  const { container } = render(<MarkdownRenderer text={markdown} dialogue={dialogue} />);
  return [...container.querySelectorAll<HTMLElement>(`.${QUOTE_CLASS}`)];
}

describe('dialogue quotes in the markdown renderer', () => {
  it('wraps a quoted run, marks included', () => {
    const [span, ...rest] = quotes('Mira said "hold the line" and left.');
    expect(rest).toHaveLength(0);
    expect(span.textContent).toBe('"hold the line"');
  });

  it('keeps a quote one run across a bold span inside it', () => {
    // Emphasis splits the quote into three text nodes in two parents. One quote, one color.
    const spans = quotes('She said "hold the **line** now" and left.');
    expect(spans.map((s) => s.textContent)).toEqual(['"hold the ', 'line', ' now"']);
    expect(spans.every((s) => s.closest('p'))).toBe(true);
  });

  it('keeps the bold inside a quote bold', () => {
    const { container } = render(<MarkdownRenderer text={'She said "hold the **line** now".'} dialogue />);
    const strong = container.querySelector('[data-streamdown="strong"]');
    expect(strong?.textContent).toBe('line');
    expect(strong?.querySelector(`.${QUOTE_CLASS}`)?.textContent).toBe('line');
  });

  it('stops an unclosed quote at the end of its paragraph', () => {
    const spans = quotes('He shouted "run for the boat\n\nThe dock was empty.');
    expect(spans.map((s) => s.textContent)).toEqual(['"run for the boat']);
  });

  it('starts each paragraph with no quote open', () => {
    // Without the reset the second paragraph would open colored and stay that way.
    const spans = quotes('He shouted "run\n\nShe said "walk" instead.');
    expect(spans.map((s) => s.textContent)).toEqual(['"run', '"walk"']);
  });

  it('leaves quotes in a code span and a fenced block alone', () => {
    expect(quotes('The flag is `--name "sedge"` here.')).toHaveLength(0);
    expect(quotes('```\nconst a = "sedge";\n```')).toHaveLength(0);
  });

  it('colors quoted speech in a list item and a heading', () => {
    expect(quotes('- Mira: "ready"').map((s) => s.textContent)).toEqual(['"ready"']);
    expect(quotes('# The "Sedge" Landing').map((s) => s.textContent)).toEqual(['"Sedge"']);
  });

  it('carries no inline style, so the color stays the stylesheet\'s to set', () => {
    const [span] = quotes('She said "hold".');
    expect(span.getAttribute('style')).toBeNull();
  });

  it('wraps nothing with the prop off', () => {
    expect(quotes('Mira said "hold the line" and left.', false)).toHaveLength(0);
  });

  it('leaves the text itself unchanged either way', () => {
    const text = 'Mira said "hold the **line**" and left.';
    const on = render(<MarkdownRenderer text={text} dialogue />).container.textContent;
    const off = render(<MarkdownRenderer text={text} />).container.textContent;
    expect(on).toBe(off);
    expect(on).toBe('Mira said "hold the line" and left.');
  });
});
