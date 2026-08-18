import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Trait } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import TraitManager from './TraitManager';

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

const store: { trait: Trait; writes: Trait[]; rerender: () => void } =
  { trait: sedgeBorn, writes: [], rerender: () => {} };

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    stats: [],
    traits: [store.trait, marshWed],
    traitGroups: [],
    placeholders: [{ id: 'p1', name: 'Hair Color', values: ['ash', 'copper'] }],
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

  it('writes a picked suggestion straight through to the trait', async () => {
    renderManager();
    await userEvent.click(pinField());
    await userEvent.click(screen.getByRole('button', { name: 'ash' }));
    expect(lastPins()).toEqual([{ placeholderId: 'p1', value: 'ash' }]);
  });

  it('writes free text through unchanged, since a pin may name a value the list doesn’t carry', async () => {
    renderManager();
    await userEvent.clear(pinField());
    await userEvent.type(pinField(), 'teal');
    expect(pinField().value).toBe('teal');
    expect(lastPins()).toEqual([{ placeholderId: 'p1', value: 'teal' }]);
  });

  it('accepts the top suggestion on Tab', async () => {
    renderManager();
    await userEvent.clear(pinField());
    await userEvent.type(pinField(), 'as');
    await userEvent.tab();
    expect(lastPins()).toEqual([{ placeholderId: 'p1', value: 'ash' }]);
  });

  it('offers nothing where the pin names no placeholder yet, and still takes text', async () => {
    store.trait = { ...sedgeBorn, placeholderPins: [{ placeholderId: '', value: '' }] };
    renderManager();
    await userEvent.type(pinField(), 'teal');
    expect(screen.queryByRole('button', { name: 'ash' })).toBeNull();
    expect(lastPins()).toEqual([{ placeholderId: '', value: 'teal' }]);
  });
});
