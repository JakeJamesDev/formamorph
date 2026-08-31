import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChipInput from './ChipInput';
import { placeholderVocabulary } from '@/lib/chipVocabulary';

const vocabulary = placeholderVocabulary([]);

/**
 * The chip field's box is a flex container, so Lexical's paragraph inside it is a flex item — and a flex
 * item shrinks to its content. An empty field's paragraph then measures zero wide, which leaves the caret
 * no line box to sit in: clicking an empty Alias or Values field looked like it did nothing.
 *
 * jsdom has no layout, so what is asserted is the rule that produces the width, the same way `EditorRow`
 * asserts its truncation contract. The width itself was measured in a browser: 0px without this, the full
 * field width with it.
 */
describe('ChipInput — the caret in an empty field', () => {
  it('gives Lexical’s paragraph a full-width line box to put the caret in', () => {
    render(
      <ChipInput value="" onChange={vi.fn()} vocabulary={vocabulary} ariaLabel="Alias" />,
    );
    expect(screen.getByLabelText('Alias').className).toContain('[&>p]:min-w-full');
  });

  it('keeps that rule when the caller adds classes of its own', () => {
    // The tag field passes its own sizing in, and `cn` merges rather than replaces — but a caller could
    // still knock the rule out with a conflicting one, which is exactly what this catches.
    render(
      <ChipInput value="" onChange={vi.fn()} vocabulary={vocabulary} ariaLabel="Tags" className="min-h-20 items-start" />,
    );
    expect(screen.getByLabelText('Tags').className).toContain('[&>p]:min-w-full');
  });
});
