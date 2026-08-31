import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';
import PlaceholderEditor from './PlaceholderEditor';
import PlaceholderManager from './PlaceholderManager';

const updatePlaceholder = vi.fn();
const addPlaceholder = vi.fn();
// The other placeholders in the same store — what a value's chips may point at. Set per test.
let siblings: Placeholder[] = [];
vi.mock('@/contexts/PlaceholderStoreContext', () => ({
  usePlaceholderStore: () => ({
    placeholders: siblings,
    setPlaceholders: vi.fn(),
    addPlaceholder,
    updatePlaceholder,
    removePlaceholder: vi.fn(),
  }),
  usePlaceholderStoreOptional: () => null,
}));
// The value boxes are Lexical editors, which jsdom can't drive. Stubbed to a real controlled textarea, so
// the typing these tests do — newlines included — is genuine right up to the manager's own seam. The
// vocabulary it was handed is reported as an attribute: the chips themselves are out of jsdom's reach, so
// how many the field can insert is the one observable fact about them left here.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder, vocabulary }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
    vocabulary?: ChipVocabulary;
  }) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      data-palette={vocabulary?.palette().length ?? 0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const PARA = 'A weathered lighthouse.\n\nIts beam sweeps the bay.';

const ph = (over: Partial<Placeholder> = {}): Placeholder => ({
  id: 'p1',
  name: 'Scene',
  values: ['Red', 'Blue'],
  ...over,
});

// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
/** A chip pointing at `id`, optionally drilled by slot name. */
const chip = (id: string, ...slots: string[]) =>
  encodePlaceholderToken({ id, mode: 'world', placementId: 'pl1', path: slots.map((name) => ({ kind: 'slot', name })) });

/** A chip drilled by an explicit pick — the other segment kind, which names a placeholder by id. */
const pickChip = (id: string, targetId: string) =>
  encodePlaceholderToken({ id, mode: 'world', placementId: 'pl1', path: [{ kind: 'val', ref: targetId }] });

/** The whole placeholder the manager last wrote through. */
const stored = () => updatePlaceholder.mock.calls.at(-1)?.at(-1) as Placeholder;

const styleToggle = () => screen.getByRole('radiogroup', { name: 'Value editor style' });
const pickStyle = (name: 'Chips' | 'Multiline') =>
  fireEvent.click(within(styleToggle()).getByRole('radio', { name }));
const kindToggle = () => screen.getByRole('radiogroup', { name: 'Placeholder kind' });
const kindOption = (name: 'Wildcard' | 'Object') => within(kindToggle()).getByRole('radio', { name });
const pickKind = (name: 'Wildcard' | 'Object') => fireEvent.click(kindOption(name));
const box = (n: number) => screen.getByLabelText(`Value ${n}`) as HTMLTextAreaElement;
const type = (n: number, text: string) => fireEvent.change(box(n), { target: { value: text } });

beforeEach(() => {
  updatePlaceholder.mockClear();
  addPlaceholder.mockClear();
  // The placeholder being edited is itself in the store, always — so the values field is never the
  // literal-only form. A test that needs targets to point at adds them.
  siblings = [ph()];
});

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
      expect(screen.getByRole('textbox', { name: 'Add keyword' })).toBeInTheDocument();
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

/**
 * The kind selector: what a placeholder *is* — a Wildcard that randomizes over its values, or an Object
 * that holds them all. The flag is written the moment the author touches the selector; until then a
 * placeholder shows the kind its value count already implies, which is why no shipped world needs
 * migrating.
 */
describe('PlaceholderManager — kind', () => {
  it('is born a Wildcard', () => {
    render(<PlaceholderEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Placeholder' }));
    expect(addPlaceholder).toHaveBeenCalledWith(expect.objectContaining({ roll: true }));
  });

  it('writes the flag the moment the author declares an Object', () => {
    render(<PlaceholderManager placeholder={ph()} />);
    pickKind('Object');
    expect(stored().roll).toBe(false);
  });

  it('writes the flag back when the author declares a Wildcard', () => {
    render(<PlaceholderManager placeholder={ph({ roll: false })} />);
    pickKind('Wildcard');
    expect(stored().roll).toBe(true);
  });

  it('keeps the kind when the one already on is clicked again', () => {
    // A single ToggleGroup clears its value when the active item is clicked again. An empty result here
    // would read as "no kind declared" and silently drop the author's word back to the inferred one.
    render(<PlaceholderManager placeholder={ph({ roll: false })} />);
    pickKind('Object');
    expect(kindOption('Object')).toBeChecked();
    expect(updatePlaceholder).not.toHaveBeenCalled();
  });

  it('shows a legacy placeholder as the Wildcard it already behaves as, and writes nothing', () => {
    render(<PlaceholderManager placeholder={ph()} />);
    expect(kindOption('Wildcard')).toBeChecked();
    expect(updatePlaceholder).not.toHaveBeenCalled();
  });

  it('stays offered at one value, where the two kinds coincide', () => {
    render(<PlaceholderManager placeholder={ph({ values: ['Red'] })} />);
    expect(kindOption('Object')).toBeEnabled();
    pickKind('Object');
    expect(stored().roll).toBe(false);
  });

  describe('the state line', () => {
    it('reads Variable at one value, whichever kind is declared', () => {
      const { rerender } = render(<PlaceholderManager placeholder={ph({ values: ['Red'] })} />);
      expect(screen.getByText('A Variable: always resolves to its one value.')).toBeInTheDocument();
      rerender(<PlaceholderManager placeholder={ph({ values: ['Red'], roll: false })} />);
      expect(screen.getByText('A Variable: always resolves to its one value.')).toBeInTheDocument();
    });

    it('counts the values a Wildcard picks between', () => {
      render(<PlaceholderManager placeholder={ph({ values: ['Red', 'Blue', 'Green'] })} />);
      expect(screen.getByText('Picks one of 3 values.')).toBeInTheDocument();
    });

    it('counts the values an Object shows together', () => {
      render(<PlaceholderManager placeholder={ph({ values: ['Red', 'Blue', 'Green'], roll: false })} />);
      expect(screen.getByText('Shows all 3 values.')).toBeInTheDocument();
    });

    it('says an empty placeholder resolves to nothing', () => {
      render(<PlaceholderManager placeholder={ph({ values: [] })} />);
      expect(screen.getByText('No values yet — this resolves to nothing.')).toBeInTheDocument();
    });

    it('follows the selector as it is pressed', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      expect(screen.getByText('Picks one of 2 values.')).toBeInTheDocument();
      pickKind('Object');
      expect(screen.getByText('Shows all 2 values.')).toBeInTheDocument();
    });
  });
});

/**
 * A value that is exactly one chip is the placeholder's structural child, so the values list is where an
 * author reads the parts a thing holds. Lexical is out of jsdom's reach, so what is asserted here is the
 * committed side: what a stored chip value reads as, and that the fields can insert one at all.
 */
describe('PlaceholderManager — chip values', () => {
  beforeEach(() => {
    siblings = [ph(), { id: 'p2', name: 'Hair', values: ['Brown', 'Blonde'] }];
  });

  it('draws a lone-chip value as its target, not as the token behind it', () => {
    render(<PlaceholderManager placeholder={ph({ values: [chip('p2')] })} />);
    expect(screen.getByText('Hair')).toBeInTheDocument();
    expect(screen.queryByText(/\{\{ph:/)).not.toBeInTheDocument();
  });

  it('draws a drilled chip as its whole path, so a part never reads like a root', () => {
    render(<PlaceholderManager placeholder={ph({ values: [chip('p2', 'Color')] })} />);
    expect(screen.getByText('Hair › Color')).toBeInTheDocument();
  });

  it('names an explicit pick by the placeholder it selects, not by its id', () => {
    siblings = [...siblings, { id: 'p3', name: 'Brown', values: ['brown'] }];
    render(<PlaceholderManager placeholder={ph({ values: [pickChip('p2', 'p3')] })} />);
    expect(screen.getByText('Hair › Brown')).toBeInTheDocument();
  });

  it('offers the typeahead in the chip row', () => {
    render(<PlaceholderManager placeholder={ph()} />);
    expect(screen.getByText('Add keyword... — { inserts a placeholder')).toBeInTheDocument();
  });

  it('hands the multiline boxes the same placeholders to insert', () => {
    render(<PlaceholderManager placeholder={ph({ values: ['Red'] })} />);
    pickStyle('Multiline');
    expect(box(1)).toHaveAttribute('data-palette', '2');
  });

  // The one-line summaries are plain text, so a chip in a value has nowhere to draw itself and would print
  // the token instead — the raw shape an author should never see.
  it('names the chip in a collapsed multiline card, rather than printing its token', () => {
    render(<PlaceholderManager placeholder={ph({ values: [chip('p2'), 'Red'] })} />);
    pickStyle('Multiline');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse value 1' }));
    expect(screen.getByText('Hair')).toBeInTheDocument();
    expect(screen.queryByText(/\{\{ph:/)).not.toBeInTheDocument();
  });

  it('names the chip in the draw-weight pop-out, rather than printing its token', () => {
    render(<PlaceholderManager placeholder={ph({ values: [chip('p2'), 'Red'] })} />);
    fireEvent.click(screen.getByText('Hair'));
    // Two now: the chip itself, and the pop-out's title for the value it opened on.
    expect(screen.getAllByText('Hair')).toHaveLength(2);
    expect(screen.queryByText(/\{\{ph:/)).not.toBeInTheDocument();
  });
});
