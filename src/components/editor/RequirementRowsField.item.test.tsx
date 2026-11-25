import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADD_FIRST, FieldHarness, sentences, writtenRows, type FieldInput } from '@/test/requirementRows';
import type { TraitRequirementRow } from '@/types';

const input: FieldInput = {
  global: { traits: [], groups: [] },
  owners: [],
  entities: [{ id: 'mira', name: 'Mira' }],
  worldItems: [
    { id: 'lamp', name: 'Lantern' },
    { id: 'ring', name: 'Cursed Ring', slotRule: { mode: 'either', slotIds: ['finger'] } },
    { id: 'rope', name: 'Rope' },
  ],
};
const MIRA = { kind: 'entity', id: 'mira', name: 'Mira' } as const;
const lit: TraitRequirementRow = { all: [{ kind: 'item', id: 'lamp', status: 'owned', owner: MIRA, state: 'lit' }] };

const field = (initial: TraitRequirementRow[] = []) => render(<FieldHarness input={input} host={{ kind: 'entity', name: 'Ash' }} initial={initial} />);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const first = () => writtenRows()[0].all[0];

describe('an item Condition in the rows editor', () => {
  it('reads as a sentence with its tokens found by label, with and without checks', () => {
    field([{ all: [{ kind: 'item', id: 'lamp', status: 'owned', owner: MIRA }] }, { all: [{ kind: 'item', id: 'lamp', status: 'owned', owner: MIRA, state: 'lit', identity: 'identified' }] }]);
    expect(sentences()).toEqual(['Mira owns Lantern and…', 'Mira owns Lantern (lit, identified) and…']);
    expect(screen.getAllByRole('button', { name: 'Owner: Mira' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Verb: owns' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Target: Lantern' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Checks: (lit, identified)' })).toHaveLength(1);
  });

  it('adds at once with no owner, so the sentence reads the host', async () => {
    const user = userEvent.setup();
    field();
    await user.click(screen.getByRole('button', { name: ADD_FIRST }));
    await user.click(screen.getByRole('option', { name: /^Lantern/ }));
    expect(screen.queryByRole('button', { name: 'Back to targets' })).toBeNull();
    expect(writtenRows()).toEqual([{ all: [{ kind: 'item', id: 'lamp', status: 'owned' }] }]);
    expect(sentences()).toEqual(['Ash owns Lantern and…']);
  });

  it('changes the owner after adding it', async () => {
    const user = userEvent.setup();
    field([{ all: [{ kind: 'item', id: 'lamp', status: 'owned' }] }]);
    await user.click(screen.getByRole('button', { name: 'Owner: Ash' }));
    await user.click(await screen.findByRole('option', { name: 'Mira' }));
    expect(first()).toEqual({ kind: 'item', id: 'lamp', status: 'owned', owner: MIRA });
  });

  it('writes the status and Not of each of the four verb forms', async () => {
    const user = userEvent.setup();
    field([{ all: [{ kind: 'item', id: 'ring', status: 'owned', owner: MIRA }] }]);
    const pick = async (from: string, to: string) => {
      await user.click(screen.getByRole('button', { name: `Verb: ${from}` }));
      await user.click(await screen.findByRole('button', { name: to }));
    };
    await pick('owns', "doesn't own");
    expect(first()).toEqual({ kind: 'item', id: 'ring', status: 'owned', owner: MIRA, not: true });
    await pick("doesn't own", 'has equipped');
    expect(first()).toEqual({ kind: 'item', id: 'ring', status: 'equipped', owner: MIRA });
    await pick('has equipped', "doesn't have equipped");
    expect(first()).toEqual({ kind: 'item', id: 'ring', status: 'equipped', owner: MIRA, not: true });
    await pick("doesn't have equipped", 'owns');
    expect(first()).toEqual({ kind: 'item', id: 'ring', status: 'owned', owner: MIRA });
  });

  it('offers has equipped only for an item that fits a slot', async () => {
    const user = userEvent.setup();
    field([{ all: [{ kind: 'item', id: 'lamp', status: 'owned', owner: MIRA }] }]);
    await user.click(screen.getByRole('button', { name: 'Verb: owns' }));
    expect(await screen.findByRole('button', { name: 'has equipped' })).toBeDisabled();
    expect(screen.getByRole('button', { name: "doesn't have equipped" })).toBeDisabled();
    expect(screen.getByRole('button', { name: "doesn't own" })).toBeEnabled();
  });

  it('swaps the target for an item of the same status and keeps the owner', async () => {
    const user = userEvent.setup();
    field([{ all: [{ kind: 'item', id: 'lamp', status: 'owned', owner: MIRA, not: true }] }]);
    await user.click(screen.getByRole('button', { name: 'Target: Lantern' }));
    await user.click(await screen.findByRole('option', { name: /^Rope/ }));
    expect(first()).toEqual({ kind: 'item', id: 'rope', status: 'owned', owner: MIRA, not: true });
  });

  it('lists only items that fit a slot beside an equipped item', async () => {
    const user = userEvent.setup();
    field([{ all: [{ kind: 'item', id: 'ring', status: 'equipped', owner: MIRA }] }]);
    await user.click(screen.getByRole('button', { name: 'Target: Cursed Ring' }));
    expect(screen.queryByRole('option', { name: /^Lantern/ })).toBeNull();
    expect(screen.getByRole('option', { name: /^Cursed Ring/ })).toBeInTheDocument();
  });

  it('writes a State word and an identity from the target popover, and clears each from the sentence', async () => {
    const user = userEvent.setup();
    field([{ all: [{ kind: 'item', id: 'lamp', status: 'owned', owner: MIRA }] }]);
    await user.click(screen.getByRole('button', { name: 'Target: Lantern' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'State' }), { target: { value: ' Lit ' } });
    expect(first()).toMatchObject({ state: 'Lit' });
    await user.click(screen.getByRole('combobox', { name: 'Identity' }));
    await user.click(await screen.findByRole('option', { name: 'Unidentified' }));
    expect(first()).toMatchObject({ state: 'Lit', identity: 'unidentified' });
    await user.click(screen.getByRole('combobox', { name: 'Identity' }));
    await user.click(await screen.findByRole('option', { name: 'Any' }));
    expect(first()).not.toHaveProperty('identity');
    fireEvent.change(screen.getByRole('textbox', { name: 'State' }), { target: { value: '' } });
    expect(first()).not.toHaveProperty('state');
    expect(sentences()).toEqual(['Mira owns Lantern and…']);
  });

  it('opens the same controls from the checks token', () => {
    field([lit]);
    click('Checks: (lit)');
    expect(screen.getByRole('textbox', { name: 'State' })).toHaveValue('lit');
    expect(screen.getByRole('combobox', { name: 'Identity' })).toHaveTextContent('Any');
  });

  it('refuses a verb that would repeat another Condition in the row', async () => {
    const user = userEvent.setup();
    field([{ all: [
      { kind: 'item', id: 'ring', status: 'owned', owner: MIRA },
      { kind: 'item', id: 'ring', status: 'owned', owner: MIRA, not: true },
    ] }]);
    await user.click(screen.getAllByRole('button', { name: 'Verb: owns' })[0]);
    expect(await screen.findByRole('button', { name: "doesn't own" })).toBeDisabled();
  });

  // The search belongs to the page; closing the picker forgets it.
  it('closing the picker forgets the search', async () => {
    render(<FieldHarness input={input} host={{ kind: 'entity', name: 'Ash' }} />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    const search = () => screen.getByPlaceholderText(/^Search /);
    fireEvent.change(search(), { target: { value: 'lan' } });
    expect(screen.queryByRole('option', { name: /^Rope/ })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(await screen.findByPlaceholderText(/^Search /)).toHaveValue('');
    expect(screen.getByRole('option', { name: /^Rope/ })).toBeInTheDocument();
  });
});
