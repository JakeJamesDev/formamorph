import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ADD_FIRST, ADD_TO_ROW, FieldHarness, sentences, writtenRows, type FieldInput } from '@/test/requirementRows';
import type { OptionRequirement, TraitRequirement, WorldOption } from '@/types';

const OPTIONS: WorldOption[] = [
  {
    id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: false,
    values: [{ id: 'easy', name: 'Easy' }, { id: 'hard', name: 'Hard' }], default: 'easy',
  },
  { id: 'perma', name: 'Permadeath', type: 'boolean', shownToPlayer: true, midGame: false, default: false },
  { id: 'party', name: 'Party Size', type: 'number', shownToPlayer: true, midGame: false, min: 1, max: 6, default: 2 },
];
const world: FieldInput = { global: { traits: [], groups: [] }, owners: [], entities: [], worldOptions: OPTIONS };

const diff = (valueId: string, valueName: string, not?: true): OptionRequirement => ({ kind: 'option', id: 'diff', name: 'Difficulty', valueId, valueName, ...(not && { not }) });
const perma = (not?: true): OptionRequirement => ({ kind: 'option', id: 'perma', name: 'Permadeath', ...(not && { not }) });
const party = (operator: OptionRequirement['operator'], value: number): OptionRequirement => ({ kind: 'option', id: 'party', name: 'Party Size', operator, value });

const rows = writtenRows;
const token = (label: string) => screen.getByRole('button', { name: label, hidden: true });
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);
const addOption = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
  fireEvent.click(screen.getByRole('option', { name }));
};
const mount = (initial: { all: TraitRequirement[] }[] = [], onOpen = () => {}) =>
  render(<FieldHarness input={world} host={{ kind: 'world' }} initial={initial} onOpen={onOpen} />);

describe('a World Option Condition in the rows editor', () => {
  it('reads a choice as "Difficulty is Easy", whose verb flips Not and whose value opens the value list', () => {
    mount();
    addOption('Difficulty');
    expect(sentences()).toEqual(['Difficulty is Easy and…']);
    fireEvent.click(token('Value: Easy'));
    expect(optionNames()).toEqual(['Easy', 'Hard']);
    fireEvent.click(screen.getByRole('option', { name: 'Hard' }));
    expect(rows()[0].all[0]).toEqual(diff('hard', 'Hard'));
    fireEvent.click(token('Change to “is not”'));
    expect(rows()[0].all[0]).toEqual(diff('hard', 'Hard', true));
    expect(sentences()).toEqual(['Difficulty is not Hard and…']);
  });

  it('reads an on/off Option as "Permadeath is on", whose value flips on one click', () => {
    mount();
    addOption('Permadeath');
    expect(sentences()).toEqual(['Permadeath is on and…']);
    fireEvent.click(token('Change to “off”'));
    expect(rows()[0].all[0]).toEqual(perma(true));
    expect(sentences()).toEqual(['Permadeath is off and…']);
    fireEvent.click(token('Change to “on”'));
    expect(rows()[0].all[0]).toEqual(perma());
  });

  it('reads a number as "Party Size is at least 2", with a comparison and a number and no Not', () => {
    mount();
    addOption('Party Size');
    expect(sentences()).toEqual(['Party Size is at least 2 and…']);
    expect(screen.queryByRole('button', { name: /^Change to/ })).toBeNull();
    fireEvent.click(token('Comparison: at least'));
    fireEvent.click(screen.getByRole('option', { name: 'at most' }));
    fireEvent.click(token('Value: 2'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '4' } });
    expect(rows()[0].all[0]).toEqual(party('<=', 4));
    expect(sentences()).toEqual(['Party Size is at most 4 and…']);
  });

  it('keeps a fractional number as a draft', () => {
    mount([{ all: [party('>=', 2)] }]);
    fireEvent.click(token('Value: 2'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '2.5' } });
    expect(rows()[0].all[0]).toEqual(party('>=', 2));
  });

  it('swaps the Option for another, which starts on its own default value', () => {
    mount([{ all: [diff('hard', 'Hard', true)] }]);
    fireEvent.click(token('Target: Difficulty'));
    expect(optionNames()).toEqual(['Difficulty', 'Permadeath', 'Party Size']);
    fireEvent.click(screen.getByRole('option', { name: 'Party Size' }));
    expect(rows()[0].all[0]).toEqual({ kind: 'option', id: 'party', name: 'Party Size', operator: '>=', value: 2 });
  });

  it('opens the Option from its target token', () => {
    const onOpen = vi.fn();
    mount([{ all: [perma()] }], onOpen);
    fireEvent.click(token('Target: Permadeath'));
    fireEvent.click(screen.getByRole('button', { name: 'Open Permadeath' }));
    expect(onOpen).toHaveBeenCalledWith(perma());
  });

  it('refuses an edit that would repeat another Condition in the row', () => {
    mount([{ all: [diff('easy', 'Easy'), diff('hard', 'Hard')] }]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Value: Easy' })[0]);
    expect(screen.getByRole('option', { name: 'Hard' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Target: Difficulty' })[0]);
    expect(screen.getByRole('option', { name: 'Permadeath' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('holds a number that would repeat another Condition as a draft', () => {
    mount([{ all: [party('>=', 2), party('>=', 3)] }]);
    fireEvent.click(token('Value: 3'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '2' } });
    expect(rows()[0].all[1]).toEqual(party('>=', 3));
  });

  it('disables an Option whose default Condition is already listed', () => {
    mount([{ all: [perma()] }]);
    fireEvent.click(screen.getByRole('button', { name: ADD_TO_ROW }));
    expect(screen.getByRole('option', { name: 'Permadeath' })).toHaveAttribute('aria-disabled', 'true');
  });
});
