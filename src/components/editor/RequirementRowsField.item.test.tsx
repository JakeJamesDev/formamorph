import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADD_FIRST, FieldHarness, sentences, writtenRows, type FieldInput } from '@/test/requirementRows';
import type { TraitRequirementRow } from '@/types';

const input: FieldInput = {
  global: { traits: [], groups: [] },
  owners: [],
  entities: [{ id: 'mira', name: 'Mira' }],
  worldItems: [{ id: 'lamp', name: 'Lantern' }],
};
const lit: TraitRequirementRow = { all: [{ kind: 'item', id: 'lamp', status: 'owned', state: 'lit' }] };

const field = (initial: TraitRequirementRow[] = []) => render(<FieldHarness input={input} host={{ kind: 'entity', name: 'Ash' }} initial={initial} />);
/** Opens the Condition's token, whose popover holds the State and identity controls. */
const openToken = () => fireEvent.click(screen.getByRole('button', { name: /^Edit Ash owns Lantern/ }));

describe('an item Condition in the rows editor', () => {
  it('reads the item and its checks in the sentence, with both fields in the popover', () => {
    field([lit]);
    expect(sentences()).toEqual(['Ash owns Lantern (lit) and…']);
    openToken();
    expect(screen.getByRole('textbox', { name: 'State' })).toHaveValue('lit');
    expect(screen.getByRole('combobox', { name: 'Identity' })).toHaveTextContent('Any');
  });

  it('writes the State word, and clears it when blank', () => {
    field([{ all: [{ kind: 'item', id: 'lamp', status: 'owned' }] }]);
    openToken();
    fireEvent.change(screen.getByRole('textbox', { name: 'State' }), { target: { value: ' Lit ' } });
    expect(writtenRows()[0].all[0]).toMatchObject({ state: 'Lit' });
    fireEvent.change(screen.getByRole('textbox', { name: 'State' }), { target: { value: '' } });
    expect(writtenRows()[0].all[0]).not.toHaveProperty('state');
  });

  it('sets and clears the identity', async () => {
    const user = userEvent.setup();
    field([lit]);
    openToken();
    await user.click(screen.getByRole('combobox', { name: 'Identity' }));
    await user.click(await screen.findByRole('option', { name: 'Unidentified' }));
    expect(writtenRows()[0].all[0]).toMatchObject({ state: 'lit', identity: 'unidentified' });
    await user.click(screen.getByRole('combobox', { name: 'Identity' }));
    await user.click(await screen.findByRole('option', { name: 'Any' }));
    expect(writtenRows()[0].all[0]).not.toHaveProperty('identity');
  });

  // Items keep the owner page until the item gets its own owner token.
  it('still asks which owner when an item is added', async () => {
    const user = userEvent.setup();
    field();
    await user.click(screen.getByRole('button', { name: ADD_FIRST }));
    await user.click(screen.getByRole('option', { name: /^Lantern/ }));
    expect(screen.getByRole('button', { name: 'Back to targets' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Mira' }));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'item', id: 'lamp', status: 'owned', owner: { kind: 'entity', id: 'mira', name: 'Mira' } }] }]);
  });

  // The search belongs to the page, so it survives a trip to the owner page; closing forgets both.
  it('goes back to the targets with the search kept, and closing the picker forgets the target and the search', async () => {
    render(<FieldHarness input={{ ...input, worldItems: [...input.worldItems!, { id: 'rope', name: 'Rope' }] }} host={{ kind: 'entity', name: 'Ash' }} />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    const search = () => screen.getByPlaceholderText(/^Search /);
    fireEvent.change(search(), { target: { value: 'lan' } });
    fireEvent.click(await screen.findByRole('option', { name: /^Lantern/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to targets' }));
    expect(search()).toHaveValue('lan');
    expect(screen.queryByRole('option', { name: /^Rope/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /^Lantern/ }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(await screen.findByPlaceholderText(/^Search /)).toHaveValue('');
    expect(screen.getByRole('option', { name: /^Rope/ })).toBeInTheDocument();
  });
});
