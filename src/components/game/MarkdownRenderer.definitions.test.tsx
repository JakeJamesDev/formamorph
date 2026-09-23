import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { markdownDefinitions } from './GamePrompts';
import { QUOTE_CLASS } from '@/lib/quoteSegments';

// Every syntax the prompt defines must display as defined in narration, or the model is told a lie.
const RENDERS: [RegExp, string][] = [
  [/^\*\*text\*\*$/, '[data-streamdown="strong"]'],
  [/^\*text\*$/, 'em'],
  [/^~~text~~$/, 'del'],
  [/^"text"$/, `.${QUOTE_CLASS}`],
];

const definedSyntax = () => markdownDefinitions(true).split('\n').map(line => /^- `([^`]+)`/.exec(line)?.[1] ?? line);

describe('markdown definitions', () => {
  it('defines only syntax the narration display renders', () => {
    const syntax = definedSyntax();
    expect(syntax).toHaveLength(RENDERS.length);
    for (const [pattern, selector] of RENDERS) {
      const sample = syntax.find(s => pattern.test(s));
      expect(sample, String(pattern)).toBeDefined();
      const { container, unmount } = render(<MarkdownRenderer text={`A ${sample} B`} dialogue />);
      expect(container.querySelector(selector)?.textContent ?? '', sample).toMatch(/^"?text"?$/);
      unmount();
    }
  });

  it('is empty while Markdown output is off', () => {
    expect(markdownDefinitions(false)).toBe('');
  });
});
