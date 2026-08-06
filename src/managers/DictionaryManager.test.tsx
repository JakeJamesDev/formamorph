import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DictionaryEntry } from '@/types';
import DictionaryManager from './DictionaryManager';

const updateDictionaryEntry = vi.fn();
vi.mock('@/contexts/DictionaryStoreContext', () => ({
  useDictionaryStore: () => ({ updateDictionaryEntry }),
}));
// Both fields are Lexical editors, which jsdom can't run. The value body isn't under test here, but the
// name field is — so it stands in as a real controlled input, keeping the typing these tests do genuine.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: () => <div />,
  PlaceholderNameField: ({ value, onChange, placeholder, ariaLabel }: {
    value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string;
  }) => (
    <input
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const entry = (over: Partial<DictionaryEntry> = {}): DictionaryEntry => ({
  id: 'e1',
  name: '',
  key: ['dragon'],
  value: 'A big lizard.',
  ...over,
});

/** The most recent patch the manager pushed for this entry. */
const lastPatch = () => updateDictionaryEntry.mock.calls.at(-1)?.at(-1) as Partial<DictionaryEntry>;

beforeEach(() => updateDictionaryEntry.mockClear());

describe('DictionaryManager — name is independent of keywords', () => {
  it('editing keywords leaves the name alone', () => {
    render(<DictionaryManager entry={entry({ name: 'Hostile Forces' })} />);
    // The chip field shows 'Add keyword...' once it already holds a chip.
    const chips = screen.getByPlaceholderText('Add keyword...');
    fireEvent.change(chips, { target: { value: 'wyrm' } });
    fireEvent.keyDown(chips, { key: 'Enter' });

    const patch = lastPatch();
    expect(patch.key).toEqual(['dragon', 'wyrm']);
    expect(patch.name).toBe('Hostile Forces'); // not overwritten with 'dragon, wyrm'
  });

  it('editing the name leaves the keywords alone', () => {
    render(<DictionaryManager entry={entry({ name: 'Old' })} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Hostile Forces'), { target: { value: 'Dragons' } });

    const patch = lastPatch();
    expect(patch.name).toBe('Dragons');
    expect(patch.key).toEqual(['dragon']);
  });

  it('shows a blank name field rather than inventing one from the keywords', () => {
    render(<DictionaryManager entry={entry({ name: '' })} />);
    expect(screen.getByPlaceholderText('e.g. Hostile Forces')).toHaveValue('');
  });
});
