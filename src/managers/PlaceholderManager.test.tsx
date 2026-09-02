import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { placeholderAccent, type ChipVocabulary } from '@/lib/chipVocabulary';
import { accentAtChance, BENCHED, chanceChipStyle, type ChanceStyle } from '@/lib/chanceColor';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';
import PlaceholderEditor from './PlaceholderEditor';
import PlaceholderManager from './PlaceholderManager';
import { phValueId, phValues } from '@/test/placeholderValues';

/** A color as jsdom stores it once set inline — `hsl(…)` comes back as `rgb(…)`, a `var()` form verbatim. */
const cssColor = (value: string) => {
  const el = document.createElement('span');
  el.style.backgroundColor = value;
  return el.style.backgroundColor;
};

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
  values: phValues(['Red', 'Blue']),
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
/** Its value list as the author reads it. Use `stored().values` where the assertion is about identity. */
const storedTexts = () => stored().values.map((v) => v.text);

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
      render(<PlaceholderManager placeholder={ph({ values: phValues([PARA, 'Dusk']) })} />);
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
      render(<PlaceholderManager placeholder={ph({ values: phValues([PARA, 'Dusk']) })} />);
      pickStyle('Chips');
      expect(screen.getByText('A weathered lighthouse. …')).toBeInTheDocument();
      expect(screen.queryByText(/beam sweeps/)).not.toBeInTheDocument();
    });
  });

  describe('editing values', () => {
    it('stores a paragraph with its newlines, trimmed only at the ends', () => {
      render(<PlaceholderManager placeholder={ph({ values: phValues(['Red']) })} />);
      pickStyle('Multiline');
      type(1, `  \n${PARA}\n  `);
      expect(storedTexts()).toEqual([PARA]);
    });

    it('drops a value that has been emptied', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      type(1, '   ');
      expect(storedTexts()).toEqual(['Blue']);
      // The box stays put — the author is mid-edit, not done with the slot.
      expect(box(1)).toHaveValue('   ');
    });

    it('collapses a box typed to match an earlier one, so the chip row never sees a repeat', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      type(2, 'Red');
      expect(storedTexts()).toEqual(['Red']);
    });

    it('leaves a box alone when its own write comes back as the placeholder', () => {
      // The real parent feeds every write back down as the prop, so the panel sees its own edit arrive from
      // outside on the very next render. Text still being typed — trailing space, empty — must survive that.
      const { rerender } = render(<PlaceholderManager placeholder={ph({ values: phValues(['Red', 'Blue']) })} />);
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
      const { rerender } = render(<PlaceholderManager placeholder={ph({ values: phValues([PARA, 'Dusk']) })} />);
      rerender(<PlaceholderManager placeholder={ph({ values: phValues([PARA, 'Nightfall']) })} />);
      expect(box(2)).toHaveValue('Nightfall');

      type(1, 'Dawn');
      expect(storedTexts()).toEqual(['Dawn', 'Nightfall']);
    });

    it('adds a value with the Add Value button', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.click(screen.getByRole('button', { name: 'Add Value' }));
      type(3, 'Green');
      expect(storedTexts()).toEqual(['Red', 'Blue', 'Green']);
    });

    it('deletes a value with its box’s remove button', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.click(screen.getByRole('button', { name: 'Remove value 1' }));
      expect(storedTexts()).toEqual(['Blue']);
      expect(screen.queryByDisplayValue('Red')).not.toBeInTheDocument();
    });
  });

  describe('weights', () => {
    const weight = (n: number) => screen.getByLabelText(`Draw weight for value ${n}`);

    it('offers no weight until there are two values to weigh', () => {
      render(<PlaceholderManager placeholder={ph({ values: phValues(['Red']) })} />);
      pickStyle('Multiline');
      expect(screen.queryByLabelText('Draw weight for value 1')).not.toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('writes a weight from the box header and shows the resulting chance', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.change(weight(1), { target: { value: '3' } });
      expect(stored().weights).toEqual({ [phValueId('Red')]: 3 });
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('keeps a weight through a rename, with nothing carried across the edit', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.change(weight(1), { target: { value: '3' } });
      type(1, 'Crimson');
      expect(storedTexts()).toEqual(['Crimson', 'Blue']);
      // The value kept its id, so the weight map is untouched and the renamed value still weighs 3.
      expect(stored().values[0].id).toBe(phValueId('Red'));
      expect(stored().weights).toEqual({ [phValueId('Red')]: 3 });
      expect(weight(1)).toHaveValue(3);
    });

    it('drops the weight of a value the author removed', () => {
      render(<PlaceholderManager placeholder={ph()} />);
      pickStyle('Multiline');
      fireEvent.change(weight(1), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Remove value 1' }));
      expect(storedTexts()).toEqual(['Blue']);
      expect(stored().weights).toBeUndefined();
    });
  });

  describe('collapsing', () => {
    const collapseAll = () => screen.getByRole('button', { name: /^(Collapse|Expand) all values$/ });

    it('collapses one card to its first line, leaving its controls live', () => {
      render(<PlaceholderManager placeholder={ph({ values: phValues([PARA, 'Dusk']) })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Collapse value 1' }));
      expect(screen.queryByLabelText('Value 1')).not.toBeInTheDocument();
      expect(screen.getByText('A weathered lighthouse. …')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Draw weight for value 1'), { target: { value: '2' } });
      expect(stored().weights).toEqual({ [phValueId(PARA)]: 2 });
      fireEvent.click(screen.getByRole('button', { name: 'Expand value 1' }));
      expect(box(1)).toHaveValue(PARA);
    });

    it('takes every card down and back up in one press', () => {
      render(<PlaceholderManager placeholder={ph({ values: phValues([PARA, 'Dusk']) })} />);
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

      render(<PlaceholderManager placeholder={ph({ values: phValues([PARA]) })} />);
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
    render(<PlaceholderManager placeholder={ph({ values: phValues(['Red']) })} />);
    expect(kindOption('Object')).toBeEnabled();
    pickKind('Object');
    expect(stored().roll).toBe(false);
  });

  describe('the state line', () => {
    it('reads Variable at one value, whichever kind is declared', () => {
      const { rerender } = render(<PlaceholderManager placeholder={ph({ values: phValues(['Red']) })} />);
      expect(screen.getByText('A Variable: always resolves to its one value.')).toBeInTheDocument();
      rerender(<PlaceholderManager placeholder={ph({ values: phValues(['Red']), roll: false })} />);
      expect(screen.getByText('A Variable: always resolves to its one value.')).toBeInTheDocument();
    });

    // A one-value Variable whose value nests wildcards is not a constant: the chips roll, so the line says
    // so and points at the World | Unique choice its chip now offers. Nesting only a plain Variable is not.
    it('reads a one-value Variable holding wildcard chips as a template that rolls', () => {
      const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `pl-${id}` });
      siblings = [
        { id: 'adj', name: 'Adjective', values: phValues(['Rusty', 'Gilded']) },
        { id: 'noun', name: 'Noun', values: phValues(['Anchor', 'Lantern']) },
        { id: 'king', name: 'King', values: phValues(['Aldric']) },
      ];
      const { rerender } = render(
        <PlaceholderManager placeholder={ph({ values: phValues([`The ${chip('adj')} ${chip('noun')}`]) })} />,
      );
      expect(screen.getByText(
        'A Variable: its one value is a template. It rolls its chips, and picks World or Unique like a Wildcard.',
      )).toBeInTheDocument();
      rerender(<PlaceholderManager placeholder={ph({ values: phValues([`King ${chip('king')}`]) })} />);
      expect(screen.getByText('A Variable: always resolves to its one value.')).toBeInTheDocument();
      siblings = [];
    });

    it('counts the values a Wildcard picks between', () => {
      render(<PlaceholderManager placeholder={ph({ values: phValues(['Red', 'Blue', 'Green']) })} />);
      expect(screen.getByText('Picks one of 3 values.')).toBeInTheDocument();
    });

    it('counts the values an Object shows together', () => {
      render(<PlaceholderManager placeholder={ph({ values: phValues(['Red', 'Blue', 'Green']), roll: false })} />);
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
    siblings = [ph(), { id: 'p2', name: 'Hair', values: phValues(['Brown', 'Blonde']) }];
  });

  it('draws a lone-chip value as its target, not as the token behind it', () => {
    render(<PlaceholderManager placeholder={ph({ values: phValues([chip('p2')]) })} />);
    expect(screen.getByText('Hair')).toBeInTheDocument();
    expect(screen.queryByText(/\{\{ph:/)).not.toBeInTheDocument();
  });

  it('wears its target’s accent, so a value that is a placeholder looks like one', () => {
    render(<PlaceholderManager placeholder={ph({ values: phValues([chip('p2'), 'Red']) })} />);
    // The accent itself comes from the vocabulary, so what is asserted is that the chip took it — at full,
    // since an even split favors neither — and that the literal value beside it stayed a plain chip.
    const chipped = screen.getByText('Hair').closest('[data-chip]') as HTMLElement;
    expect(chipped.style.backgroundColor).toBe(cssColor(accentAtChance(placeholderAccent('p2'), 100).backgroundColor));
    expect((screen.getByText('Red').closest('[data-chip]') as HTMLElement).style.backgroundColor)
      .toBe('hsl(var(--secondary))');
  });

  it('draws a drilled chip as its whole path, so a part never reads like a root', () => {
    render(<PlaceholderManager placeholder={ph({ values: phValues([chip('p2', 'Color')]) })} />);
    expect(screen.getByText('Hair › Color')).toBeInTheDocument();
  });

  it('names an explicit pick by the placeholder it selects, not by its id', () => {
    siblings = [...siblings, { id: 'p3', name: 'Brown', values: phValues(['brown']) }];
    render(<PlaceholderManager placeholder={ph({ values: phValues([pickChip('p2', 'p3')]) })} />);
    expect(screen.getByText('Hair › Brown')).toBeInTheDocument();
  });

  it('offers the typeahead in the chip row', () => {
    render(<PlaceholderManager placeholder={ph()} />);
    expect(screen.getByText('Add keyword... — { inserts a placeholder')).toBeInTheDocument();
  });

  it('hands the multiline boxes the same placeholders to insert', () => {
    render(<PlaceholderManager placeholder={ph({ values: phValues(['Red']) })} />);
    pickStyle('Multiline');
    expect(box(1)).toHaveAttribute('data-palette', '2');
  });

  // The one-line summaries are plain text, so a chip in a value has nowhere to draw itself and would print
  // the token instead — the raw shape an author should never see.
  it('names the chip in a collapsed multiline card, rather than printing its token', () => {
    render(<PlaceholderManager placeholder={ph({ values: phValues([chip('p2'), 'Red']) })} />);
    pickStyle('Multiline');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse value 1' }));
    expect(screen.getByText('Hair')).toBeInTheDocument();
    expect(screen.queryByText(/\{\{ph:/)).not.toBeInTheDocument();
  });

  it('names the chip in the draw-weight pop-out, rather than printing its token', () => {
    render(<PlaceholderManager placeholder={ph({ values: phValues([chip('p2'), 'Red']) })} />);
    fireEvent.click(screen.getByText('Hair'));
    // Two now: the chip itself, and the pop-out's title for the value it opened on.
    expect(screen.getAllByText('Hair')).toHaveLength(2);
    expect(screen.queryByText(/\{\{ph:/)).not.toBeInTheDocument();
  });
});

/**
 * An Object applies every value together and never draws, so nothing about it is worth weighing: the chip
 * pop-out, the box stepper and the eye all go. Roll stays — an Object that nests wildcards still gives a
 * useful sample — and the Wildcard kind brings all three back.
 */
describe('PlaceholderManager — an Object', () => {
  const three = () => phValues(['Red', 'Blue', 'Green']);
  const eye = () => screen.queryByRole('button', { name: /roll chances/i });
  const stepper = () => screen.queryByLabelText('Draw weight for value 1');
  const popOut = () => screen.queryByLabelText('Draw weight');

  it('opens no weight pop-out on a chip click', () => {
    render(<PlaceholderManager placeholder={ph({ roll: false, values: three() })} />);
    fireEvent.click(screen.getByText('Red'));
    expect(popOut()).not.toBeInTheDocument();
  });

  it('shows no stepper in the box view', () => {
    render(<PlaceholderManager placeholder={ph({ roll: false, values: three() })} />);
    pickStyle('Multiline');
    expect(box(3)).toBeInTheDocument();
    expect(stepper()).not.toBeInTheDocument();
  });

  it('offers no eye, and keeps Roll', () => {
    render(<PlaceholderManager placeholder={ph({ roll: false, values: three() })} />);
    expect(eye()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll' })).toBeInTheDocument();
  });

  it('gets all three back the moment it is declared a Wildcard', () => {
    render(<PlaceholderManager placeholder={ph({ roll: false, values: three() })} />);
    pickKind('Wildcard');
    expect(eye()).toBeInTheDocument();
    fireEvent.click(screen.getByText('Red'));
    expect(popOut()).toBeInTheDocument();
    pickStyle('Multiline');
    expect(stepper()).toBeInTheDocument();
  });

  it('takes the revealed numbers down with the eye when a Wildcard is declared an Object', () => {
    render(<PlaceholderManager placeholder={ph({ values: three() })} />);
    fireEvent.click(screen.getByRole('button', { name: /Show roll chances/i }));
    expect(screen.getByText(/^Red/)).toHaveTextContent('(33%)');
    pickKind('Object');
    expect(eye()).not.toBeInTheDocument();
    expect(screen.getByText(/^Red/)).not.toHaveTextContent('%');
  });

  it('closes an open weight pop-out when a Wildcard is declared an Object', () => {
    render(<PlaceholderManager placeholder={ph({ values: three() })} />);
    fireEvent.click(screen.getByText('Red'));
    expect(popOut()).toBeInTheDocument();
    pickKind('Object');
    expect(popOut()).not.toBeInTheDocument();
  });
});

/**
 * A shared row opens this same panel with the name, the kind and the values locked — they belong to the
 * original — and the draw weights live. Those weights are written as an override on the holder, so benching
 * a value for one character leaves the original, and every other holder, exactly as they were.
 */
describe('PlaceholderManager — a shared row', () => {
  /** Molly holds the placeholder under test without owning it, which is what makes the row a shared one. */
  const holder = (over: Partial<Placeholder> = {}): Placeholder => ({
    id: 'h1', name: 'Molly', roll: false, values: phValues([chip('p1')]), ...over,
  });
  const site = { ownerId: 'h1', key: phValueId(chip('p1')) };
  const shared = (over: Partial<Placeholder> = {}) =>
    render(<PlaceholderManager placeholder={ph(over)} share={site} />);
  const weightChip = (label: string) => screen.getByRole('button', { name: `Draw weight for ${label}` });
  const setWeight = (n: number) => fireEvent.change(screen.getByLabelText('Draw weight'), { target: { value: String(n) } });

  beforeEach(() => { siblings = [holder(), ph()]; });

  it('locks the name, the kind and the value list', () => {
    shared();
    expect(screen.getByDisplayValue('Scene')).toBeDisabled();
    expect(kindOption('Object')).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: 'Add keyword' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Value editor style' })).not.toBeInTheDocument();
    expect(screen.getByText(/values come from the original/i)).toBeInTheDocument();
  });

  it('writes the weight onto the holder, and never onto the original', () => {
    shared();
    fireEvent.click(weightChip('Red'));
    setWeight(0);
    expect(stored().id).toBe('h1');
    expect(stored().sharedWeights).toEqual({ [site.key]: { [phValueId('Red')]: 0 } });
    expect(stored().values.map((v) => v.text)).toEqual([chip('p1')]); // the holder is otherwise untouched
  });

  it('drops the override when the weight goes back to what the original draws by', () => {
    siblings = [holder({ sharedWeights: { [site.key]: { [phValueId('Red')]: 0 } } }), ph()];
    shared();
    fireEvent.click(weightChip('Red'));
    setWeight(1);
    expect(stored().sharedWeights).toBeUndefined();
  });

  it('reads the merged weights, so the revealed chance belongs to this row', () => {
    siblings = [holder({ sharedWeights: { [site.key]: { [phValueId('Red')]: 0 } } }), ph()];
    shared();
    fireEvent.click(screen.getByRole('button', { name: /Show roll chances/i }));
    expect(weightChip('Red')).toHaveTextContent('(0%)');
    expect(weightChip('Blue')).toHaveTextContent('(100%)');
  });

  it('keeps a benched value in the list, which is the only way back off the bench', () => {
    siblings = [holder({ sharedWeights: { [site.key]: { [phValueId('Red')]: 0 } } }), ph()];
    shared();
    expect(weightChip('Red')).toBeInTheDocument();
  });

  it('offers no weight on a shared Object, and says why', () => {
    shared({ roll: false });
    expect(screen.queryByRole('button', { name: /Draw weight for/ })).not.toBeInTheDocument();
    expect(screen.getByText(/never draws/i)).toBeInTheDocument();
  });

  it('falls back to the plain editor when the holder is gone', () => {
    siblings = [ph()];
    shared();
    expect(screen.getByDisplayValue('Scene')).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Add keyword' })).toBeInTheDocument();
  });

  // The wiring: the list selects rows, and which row it is decides whether the panel locks. Both rows here
  // are the one placeholder, so a panel keyed by the placeholder alone could not tell them apart.
  it('locks the nested row and leaves the original unlocked, from the list', () => {
    render(<PlaceholderEditor />);
    const rows = screen.getAllByRole('button', { name: 'Duplicate' })
      .map((b) => b.parentElement as HTMLElement);
    const named = (name: string) =>
      rows.filter((r) => r.querySelector('span.flex-grow')?.textContent === name);
    // Molly, then Scene under her, then Scene at the top level.
    expect(named('Scene')).toHaveLength(2);

    fireEvent.click(named('Scene')[0].querySelector('span.flex-grow') as HTMLElement);
    expect(screen.getByDisplayValue('Scene')).toBeDisabled();

    fireEvent.click(named('Scene')[1].querySelector('span.flex-grow') as HTMLElement);
    expect(screen.getByDisplayValue('Scene')).toBeEnabled();
  });
});

/** Chips carry their draw chance in color at all times; the eye adds the number. The color is relative:
 *  each value against the strongest sibling, so an even split is a row of ordinary chips and a value fades
 *  only when another is favored over it. A plain value mixes toward the benched look; a value that is
 *  another placeholder keeps that placeholder's hue and loses saturation, and at 0 both look the same. The
 *  number stays the real chance, ancestors multiplied in, so a nested chip's figure reads as the branch it
 *  really is. */
describe('PlaceholderManager — chance coloring', () => {
  const chipOf = (label: string) => screen.getByText(label).closest('[data-chip]') as HTMLElement;
  const bg = (label: string) => chipOf(label).style.backgroundColor;
  const look = (label: string) => {
    const { backgroundColor, color, opacity } = chipOf(label).style;
    return { backgroundColor, color, opacity };
  };
  const css = (style: ChanceStyle) => ({
    backgroundColor: cssColor(style.backgroundColor), color: cssColor(style.color), opacity: String(style.opacity),
  });

  it('shows an even split as ordinary secondary chips, nothing faded', () => {
    render(<PlaceholderManager placeholder={ph({ values: phValues(['Ash', 'Jet', 'Rust', 'Moss']) })} />);
    for (const v of ['Ash', 'Jet', 'Rust', 'Moss']) expect(look(v)).toEqual(css(chanceChipStyle(100)));
  });

  it('fades the values a heavier sibling is favored over, at their share of its chance', () => {
    render(<PlaceholderManager placeholder={ph({
      values: phValues(['Ash', 'Jet', 'Rust', 'Moss']), weights: { [phValueId('Ash')]: 3 },
    })} />);
    expect(look('Ash')).toEqual(css(chanceChipStyle(100)));
    for (const v of ['Jet', 'Rust', 'Moss']) expect(look(v)).toEqual(css(chanceChipStyle(100 / 3)));
  });

  it('benches a weight-0 value of either kind to one identical look', () => {
    siblings = [ph(), { id: 'p2', name: 'Hair', values: phValues(['Brown', 'Blonde']) }];
    render(<PlaceholderManager placeholder={ph({
      values: phValues(['Red', 'Blue', chip('p2')]), weights: { [phValueId('Blue')]: 0, [phValueId(chip('p2'))]: 0 },
    })} />);
    expect(look('Red')).toEqual(css(chanceChipStyle(100)));
    expect(look('Blue')).toEqual(css(BENCHED));
    expect(look('Hair')).toEqual(css(BENCHED));
  });

  it('colors every value of an Object as full — all of them apply', () => {
    render(<PlaceholderManager placeholder={ph({ roll: false })} />);
    expect(bg('Red')).toBe(chanceChipStyle(100).backgroundColor);
  });

  it('keeps a reference chip’s color relative to its siblings while its number carries the row it sits in', () => {
    // Molly picks one of two variants; the Northern variant is one of two values holding Hair.
    const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['Brown', 'Blonde']) };
    const northern: Placeholder = { id: 'northern', name: 'Northern', values: phValues([chip('hair'), 'bald']) };
    const molly: Placeholder = { id: 'molly', name: 'Molly', values: phValues([chip('northern'), 'Southern']) };
    siblings = [molly, northern, hair];
    render(<PlaceholderManager placeholder={northern} rowId="molly/northern" />);
    // Hair and bald split Northern evenly, so neither is favored: the row's 50% is common to both.
    expect(bg('Hair')).toBe(cssColor(accentAtChance(placeholderAccent('hair'), 100).backgroundColor));
    fireEvent.click(screen.getByRole('button', { name: /Show roll chances/i }));
    const chips = [...document.querySelectorAll('[data-chip]')].map((el) => el.textContent);
    // 50% of Northern's own draw, inside Molly's 50% branch.
    expect(chips).toContain('Hair (25%)');
    // The plain value beside it shows its own chance — the ramp reads the placeholder's shape.
    expect(chips).toContain('bald (50%)');
  });

  it('desaturates a reference chip a sibling is favored over', () => {
    siblings = [ph(), { id: 'p2', name: 'Hair', values: phValues(['Brown', 'Blonde']) }];
    render(<PlaceholderManager placeholder={ph({
      values: phValues(['Red', chip('p2')]), weights: { [phValueId('Red')]: 4 },
    })} />);
    expect(bg('Hair')).toBe(cssColor(accentAtChance(placeholderAccent('p2'), 25).backgroundColor));
  });

  it('offers the eye whenever there is more than one value, weighted or not', () => {
    render(<PlaceholderManager placeholder={ph()} />);
    expect(screen.getByRole('button', { name: /Show roll chances/i })).toBeInTheDocument();
  });

  it('colors a shared row’s read-only chips the same way', () => {
    const molly: Placeholder = { id: 'molly', name: 'Molly', values: phValues([chip('p1')]) };
    siblings = [ph(), molly];
    render(<PlaceholderManager placeholder={ph()} rowId="molly/p1" share={{ ownerId: 'molly', key: phValueId(chip('p1')) }} />);
    expect(bg('Red')).toBe(chanceChipStyle(100).backgroundColor);
  });
});

/** The dice: one sample of what the placeholder produces, nested chips resolved, drawn again on every
 *  click and never stored. */
describe('PlaceholderManager — the sample roll', () => {
  const roll = () => screen.getByRole('button', { name: 'Roll' });

  it('shows the result inline, with nested chips resolved to a real string', () => {
    siblings = [ph(), { id: 'p2', name: 'Hair', values: phValues(['Brown']) }];
    render(<PlaceholderManager placeholder={ph({ values: phValues([`${chip('p2')} hair`]) })} />);
    fireEvent.click(roll());
    expect(screen.getByRole('status', { name: 'Sample roll' })).toHaveTextContent('Brown hair');
  });

  it('draws again on each click', () => {
    const values = phValues(['Red', 'Blue']);
    render(<PlaceholderManager placeholder={ph({ values })} />);
    const seen = new Set<string>();
    for (let i = 0; i < 40 && seen.size < 2; i++) {
      fireEvent.click(roll());
      seen.add(screen.getByRole('status', { name: 'Sample roll' }).textContent ?? '');
    }
    expect(seen).toEqual(new Set(['Red', 'Blue']));
  });

  it('respects a benched value', () => {
    render(<PlaceholderManager placeholder={ph({ weights: { [phValueId('Blue')]: 0 } })} />);
    for (let i = 0; i < 20; i++) {
      fireEvent.click(roll());
      expect(screen.getByRole('status', { name: 'Sample roll' })).toHaveTextContent('Red');
    }
  });

  it('is hidden with nothing to draw from, and persists nothing', () => {
    render(<PlaceholderManager placeholder={ph({ values: [] })} />);
    expect(screen.queryByRole('button', { name: 'Roll' })).not.toBeInTheDocument();
    render(<PlaceholderManager placeholder={ph({ id: 'other' })} />);
    fireEvent.click(roll());
    expect(updatePlaceholder).not.toHaveBeenCalled();
  });

  it('drops the sample once the values change under it', () => {
    render(<PlaceholderManager placeholder={ph()} />);
    fireEvent.click(roll());
    expect(screen.getByRole('status', { name: 'Sample roll' })).toBeInTheDocument();
    pickStyle('Multiline');
    type(1, 'Crimson');
    expect(screen.queryByRole('status', { name: 'Sample roll' })).not.toBeInTheDocument();
  });
});
