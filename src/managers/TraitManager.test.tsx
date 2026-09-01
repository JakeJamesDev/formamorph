import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder, Trait } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import TraitManager from './TraitManager';

import { phValueId, phValues } from '@/test/placeholderValues';
// A trait pinning a hair color — the row the pin editor exists for.
const sedgeBorn = {
  id: 't1', name: 'Sedge-Born', statChanges: [],
  placeholderPins: [{ placeholderId: 'p1', value: 'copper' }],
} as unknown as Trait;

// A lower-listed rival pinning the same placeholder, so the conflict note has something to say.
const marshWed = {
  id: 't2', name: 'Marsh-Wed', statChanges: [],
  placeholderPins: [{ placeholderId: 'p1', value: 'sable' }],
} as unknown as Trait;

// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

// Hair Color is the flat placeholder the pin row was built for; Molly is the structured one — a Wildcard
// whose two values are each a whole other placeholder, which is what a pin has to be able to name. The
// variants are Objects, so what each one joins to is a soup and its name is the thing an author picks by.
const WORLD: Placeholder[] = [
  { id: 'p1', name: 'Hair Color', values: phValues(['ash', 'copper']) },
  { id: 'molly', name: 'Molly', values: phValues([chip('iswhite'), chip('isasian'), `freckled ${chip('isasian')}`]) },
  { id: 'iswhite', name: 'isWhite', roll: false, values: phValues(['fair skin', 'ash hair']) },
  { id: 'isasian', name: 'isAsian', roll: false, values: phValues(['tan skin', 'black hair']) },
];

const store: { trait: Trait; rival: Trait; writes: Trait[]; rerender: () => void } =
  { trait: sedgeBorn, rival: marshWed, writes: [], rerender: () => {} };

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    stats: [],
    traits: [store.trait, store.rival],
    traitGroups: [],
    placeholders: WORLD,
    updateTrait: (next: Trait) => {
      store.writes.push(next);
      store.trait = next;
      store.rerender();
    },
  }),
}));
// The chip fields are Lexical editors this test has no use for; the pin row is what is under test.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { label: string; value: string }) => <input readOnly aria-label={props.label} value={props.value} />,
  PlaceholderNameField: (props: { value: string }) => <input readOnly value={props.value} />,
}));

const onOpenTrait = vi.fn();

/** Renders the manager against the live store, re-rendering whenever it writes. */
const Harness = () => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return <TraitManager trait={store.trait} onOpenTrait={onOpenTrait} />;
};

const renderManager = () => render(
  <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
    <Harness />
  </EditorModeContext.Provider>,
);

const pinField = () => screen.getByRole('textbox', { name: 'Pinned value' }) as HTMLInputElement;
const lastPins = () => store.writes[store.writes.length - 1].placeholderPins;

beforeEach(() => {
  store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: 'p1', value: 'copper' }] };
  store.rival = marshWed;
  store.writes = [];
  onOpenTrait.mockClear();
});

// An unknown topic id renders no button at all, so the hint buttons prove their ids resolve.
describe('the section help buttons', () => {
  it('mount registered topics for all three sections', () => {
    renderManager();
    expect(screen.getByRole('button', { name: 'About Stat Changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Stat Availability' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Placeholder Pins' })).toBeInTheDocument();
  });
});

describe('the conflict note', () => {
  it('names the winner and navigates to a clicked rival', async () => {
    renderManager();
    // Sedge-Born sits above Marsh-Wed, so Marsh-Wed wins — named as the winner, and clickable.
    expect(screen.getByText(/The lowest in the trait list wins/)).toBeInTheDocument();
    // Named twice — once in the rival list, once as the winner — and both navigate.
    const links = screen.getAllByRole('button', { name: 'Marsh-Wed' });
    expect(links).toHaveLength(2);
    await userEvent.click(links[0]);
    expect(onOpenTrait).toHaveBeenCalledWith('t2');
  });

  it('shows a rival’s name resolved, never as the token behind it', () => {
    store.rival = { ...marshWed, name: `${chip('p1')} Kin` };
    renderManager();
    const note = screen.getByText(/The lowest in the trait list wins/);
    expect(note.textContent).not.toContain('{{ph:');
    // The pill previews the placeholder's values, the way every read-only row does.
    expect(note.textContent).toContain('ash|copper Kin');
  });
});

describe('the placeholder pin row', () => {
  it('suggests the pinned placeholder’s own values, in the shared autocomplete', async () => {
    renderManager();
    expect(pinField().value).toBe('copper');
    // A committed on-list value opens the full list so a different value is one click away.
    await userEvent.click(pinField());
    expect(screen.getByRole('button', { name: 'ash' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'copper' })).toBeInTheDocument();
  });

  it('writes a picked suggestion through, naming the value it picked by id', async () => {
    renderManager();
    await userEvent.click(pinField());
    await userEvent.click(screen.getByRole('button', { name: 'ash' }));
    // The id is what the pin follows, so re-spelling “ash” later moves the pin with it.
    expect(lastPins()).toEqual([{ placeholderId: 'p1', value: 'ash', valueId: phValueId('ash') }]);
  });

  it('writes free text through unchanged, since a pin may name a value the list doesn’t carry', async () => {
    renderManager();
    await userEvent.clear(pinField());
    await userEvent.type(pinField(), 'teal');
    expect(pinField().value).toBe('teal');
    // No value spells it, so the pin stays the free text it is — no id to follow.
    expect(lastPins()).toEqual([{ placeholderId: 'p1', value: 'teal' }]);
  });

  it('accepts the top suggestion on Tab', async () => {
    renderManager();
    await userEvent.clear(pinField());
    await userEvent.type(pinField(), 'as');
    await userEvent.tab();
    expect(lastPins()).toEqual([{ placeholderId: 'p1', value: 'ash', valueId: phValueId('ash') }]);
  });

  it('offers a value that is one whole chip by the part it names, never as the token behind it', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: 'molly', value: '' }] };
    renderManager();
    await userEvent.click(pinField());
    expect(screen.getByRole('button', { name: 'isWhite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'isAsian' })).toBeInTheDocument();
    // What the variant joins to is a soup of its parts; its name is what an author pins by.
    expect(screen.queryByRole('button', { name: 'tan skin, black hair' })).toBeNull();
  });

  it('offers a chip inside longer text as what it will read as, since that value is prose', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: 'molly', value: '' }] };
    renderManager();
    await userEvent.click(pinField());
    expect(screen.getByRole('button', { name: 'freckled tan skin, black hair' })).toBeInTheDocument();
  });

  it('pins the variant itself when one is picked, not the name it reads as', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: 'molly', value: '' }] };
    renderManager();
    await userEvent.click(pinField());
    await userEvent.click(screen.getByRole('button', { name: 'isAsian' }));
    // The stored value is the chip — which is what resolution follows into isAsian.
    expect(lastPins()).toEqual([{
      placeholderId: 'molly', value: chip('isasian'), valueId: phValueId(chip('isasian')),
    }]);
  });

  it('shows a pinned variant as a pill, leaving the field empty rather than full of token', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: 'molly', value: chip('isasian') }] };
    renderManager();
    expect(pinField().value).toBe('');
    expect(screen.getByText('isAsian')).toBeInTheDocument();
    // Clearing the pill empties the pin without dropping its row, so a different value is one pick away.
    await userEvent.click(screen.getByRole('button', { name: 'Remove isAsian' }));
    expect(lastPins()).toEqual([{ placeholderId: 'molly', value: '' }]);
  });

  it('leaves a pinned variant alone when Tab moves on, since nothing was typed', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: 'molly', value: chip('isasian') }] };
    renderManager();
    // Focus opens the whole list with its first row highlighted; Tab past it must deposit nothing.
    await userEvent.click(pinField());
    await userEvent.tab();
    expect(store.writes).toEqual([]);
  });

  it('replaces a pinned variant with free text on the first keystroke', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: 'molly', value: chip('isasian') }] };
    renderManager();
    await userEvent.type(pinField(), 'teal');
    expect(lastPins()).toEqual([{ placeholderId: 'molly', value: 'teal' }]);
    expect(screen.queryByText('isAsian')).toBeNull();
  });

  it('offers nothing where the pin names no placeholder yet, and still takes text', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: '', value: '' }] };
    renderManager();
    await userEvent.type(pinField(), 'teal');
    expect(screen.queryByRole('button', { name: 'ash' })).toBeNull();
    expect(lastPins()).toEqual([{ placeholderId: '', value: 'teal' }]);
  });
});
