import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Placeholder } from '@/types';
import PlaceholderManager from './PlaceholderManager';

const updatePlaceholder = vi.fn();
vi.mock('@/contexts/PlaceholderStoreContext', () => ({
  usePlaceholderStore: () => ({ updatePlaceholder }),
  // Reached by the chip row's vocabulary hook, which has nothing to look up in a literal value list.
  usePlaceholderStoreOptional: () => null,
}));
// The value boxes are Lexical editors, which jsdom can't drive. Stubbed to a real controlled textarea, so
// the typing these tests do — newlines included — is genuine right up to the manager's own seam.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
  }) => (
    <textarea aria-label={ariaLabel} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const PARA = 'A weathered lighthouse.\n\nIts beam sweeps the bay.';

const ph = (over: Partial<Placeholder> = {}): Placeholder => ({
  id: 'p1',
  name: 'Scene',
  values: ['Red', 'Blue'],
  ...over,
});

/** The whole placeholder the manager last wrote through. */
const stored = () => updatePlaceholder.mock.calls.at(-1)?.at(-1) as Placeholder;

const styleToggle = () => screen.getByRole('radiogroup', { name: 'Value editor style' });
const pickStyle = (name: 'Chips' | 'Multiline') =>
  fireEvent.click(within(styleToggle()).getByRole('radio', { name }));
const box = (n: number) => screen.getByLabelText(`Value ${n}`) as HTMLTextAreaElement;
const type = (n: number, text: string) => fireEvent.change(box(n), { target: { value: text } });

beforeEach(() => updatePlaceholder.mockClear());

/**
 * The placeholder editor's two value-editing styles. The chip row is the short-value case it has always
 * been; the multiline view is one markdown box per value, for the paragraph-length values authors write.
 * Both write the same `values: string[]` — the toggle is a lens, not a shape.
 */
describe('PlaceholderManager — chips vs multiline', () => {
  describe('which style opens', () => {
    it('opens in multiline when any value holds a newline', () => {
      render(<PlaceholderManager placeholder={ph({ values: [PARA, 'Dusk'] })} />);
      expect(within(styleToggle()).getByRole('radio', { name: 'Multiline' })).toBeChecked();
      expect(box(1)).toHaveValue(PARA);
    });

    it('keeps the chip row for short values', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      expect(within(styleToggle()).getByRole('radio', { name: 'Chips' })).toBeChecked();
      expect(screen.queryByLabelText('Value 1')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add keyword...')).toBeInTheDocument();
    });

    it('changes nothing in the store on a round trip through both styles', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      expect(box(1)).toHaveValue('Red');
      pickStyle('Chips');
      expect(updatePlaceholder).not.toHaveBeenCalled();
    });

    it('shows a multiline value in the chip row as its first line', () => {
      render(<PlaceholderManager placeholder={ph({ values: [PARA, 'Dusk'] })} />);
      pickStyle('Chips');
      expect(screen.getByText('A weathered lighthouse. …')).toBeInTheDocument();
      expect(screen.queryByText(/beam sweeps/)).not.toBeInTheDocument();
    });
  });

  describe('editing values', () => {
    it('stores a paragraph with its newlines, trimmed only at the ends', () => {
      render(<PlaceholderManager placeholder={ph({ values: ['Red'] })} />);
      pickStyle('Multiline');
      type(1, `  \n${PARA}\n  `);
      expect(stored().values).toEqual([PARA]);
    });

    it('drops a value that has been emptied', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      type(1, '   ');
      expect(stored().values).toEqual(['Blue']);
      // The box stays put — the author is mid-edit, not done with the slot.
      expect(box(1)).toHaveValue('   ');
    });

    it('collapses a box typed to match an earlier one, so the chip row never sees a repeat', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      type(2, 'Red');
      expect(stored().values).toEqual(['Red']);
    });

    it('leaves a box alone when its own write comes back as the placeholder', () => {
      // The real parent feeds every write back down as the prop, so the panel sees its own edit arrive from
      // outside on the very next render. Text still being typed — trailing space, empty — must survive that.
      const { rerender } = render(<PlaceholderManager placeholder={ph({ values: ['Red', 'Blue'] })} />);
      pickStyle('Multiline');
      fireEvent.click(screen.getByRole('button', { name: 'Collapse value 2' }));
      type(1, 'Crimson ');
      rerender(<PlaceholderManager placeholder={stored()} />);

      expect(box(1)).toHaveValue('Crimson '); // not trimmed back under the caret
      expect(screen.getByRole('button', { name: 'Expand value 2' })).toBeInTheDocument(); // still collapsed
    });

    it('re-reads a value list rewritten from outside, and does not paste the old one back', () => {
      // The find bar replaces inside placeholder values, through the same store, while this panel is open
      // on that placeholder. The boxes are the editing truth only for edits they made themselves.
      const { rerender } = render(<PlaceholderManager placeholder={ph({ values: [PARA, 'Dusk'] })} />);
      rerender(<PlaceholderManager placeholder={ph({ values: [PARA, 'Nightfall'] })} />);
      expect(box(2)).toHaveValue('Nightfall');

      type(1, 'Dawn');
      expect(stored().values).toEqual(['Dawn', 'Nightfall']);
    });

    it('adds a value with the Add Value button', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.click(screen.getByRole('button', { name: 'Add Value' }));
      type(3, 'Green');
      expect(stored().values).toEqual(['Red', 'Blue', 'Green']);
    });

    it('deletes a value with its box’s remove button', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.click(screen.getByRole('button', { name: 'Remove value 1' }));
      expect(stored().values).toEqual(['Blue']);
      expect(screen.queryByDisplayValue('Red')).not.toBeInTheDocument();
    });
  });

  describe('weights', () => {
    const weight = (n: number) => screen.getByLabelText(`Draw weight for value ${n}`);

    it('offers no weight until there are two values to weigh', () => {
      render(<PlaceholderManager placeholder={ph({ values: ['Red'] })} />);
      pickStyle('Multiline');
      expect(screen.queryByLabelText('Draw weight for value 1')).not.toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('writes a weight from the box header and shows the resulting chance', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.change(weight(1), { target: { value: '3' } });
      expect(stored().weights).toEqual({ Red: 3 });
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('carries a weight across a rewrite of the value it belongs to', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.change(weight(1), { target: { value: '3' } });
      type(1, 'Crimson');
      expect(stored().values).toEqual(['Crimson', 'Blue']);
      expect(stored().weights).toEqual({ Crimson: 3 });
    });
  });

  describe('collapsing', () => {
    const collapseAll = () => screen.getByRole('button', { name: /^(Collapse|Expand) all values$/ });

    it('collapses one card to its first line, leaving its controls live', () => {
      render(<PlaceholderManager placeholder={ph({ values: [PARA, 'Dusk'] })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Collapse value 1' }));
      expect(screen.queryByLabelText('Value 1')).not.toBeInTheDocument();
      expect(screen.getByText('A weathered lighthouse. …')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Draw weight for value 1'), { target: { value: '2' } });
      expect(stored().weights).toEqual({ [PARA]: 2 });
      fireEvent.click(screen.getByRole('button', { name: 'Expand value 1' }));
      expect(box(1)).toHaveValue(PARA);
    });

    it('takes every card down and back up in one press', () => {
      render(<PlaceholderManager placeholder={ph({ values: [PARA, 'Dusk'] })} />);
      fireEvent.click(collapseAll());
      expect(screen.queryByLabelText('Value 1')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Value 2')).not.toBeInTheDocument();

      fireEvent.click(collapseAll()); // now reading 'Expand all values'
      expect(box(1)).toHaveValue(PARA);
      expect(box(2)).toHaveValue('Dusk');
    });

    it('is not offered in the chip row, nor for a lone value', () => {
      const { unmount } = render(<PlaceholderManager placeholder={ph()} />);
      expect(screen.queryByRole('button', { name: /all values$/ })).not.toBeInTheDocument();
      unmount();

      render(<PlaceholderManager placeholder={ph({ values: [PARA] })} />);
      expect(screen.queryByRole('button', { name: /all values$/ })).not.toBeInTheDocument();
    });
  });
});
