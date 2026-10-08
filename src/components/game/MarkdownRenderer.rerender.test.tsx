import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

// A live preview re-renders the same instance as the author types. Each edit here leaves the edited
// element's first and last source positions where they were, so a renderer that caches elements on
// position alone keeps showing the old text.

const EDITS: [label: string, before: string, after: string][] = [
  ['bold on the first item of a list', '* foo bar\n* baz', '* **foo** bar\n* baz'],
  ['bold on the first line of a two-line list item', '* foo bar\n  more', '* **foo** bar\n  more'],
  ['a highlight color swap inside a list item', '* =r=foo== bar', '* =g=foo== bar'],
  ['a same-length word change inside a list item', '* foo bar', '* foo baz'],
  ['bold on the first line of a two-line paragraph', 'foo bar\nmore', '**foo** bar\nmore'],
  ['bold on the first line of a two-line quote', '> foo bar\n> more', '> **foo** bar\n> more'],
];

describe('MarkdownRenderer re-render', () => {
  it.each(EDITS)('shows %s', (_label, before, after) => {
    const live = render(<MarkdownRenderer text={before} tinted />);
    live.rerender(<MarkdownRenderer text={after} tinted />);
    const fresh = render(<MarkdownRenderer text={after} tinted />);
    expect(live.container.innerHTML).toBe(fresh.container.innerHTML);
  });
});
