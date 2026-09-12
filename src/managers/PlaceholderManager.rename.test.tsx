import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder, Stat } from '@/types';
import type { PlaceholderOwnerRef } from '@/lib/placeholderHomes';
import { CodeRenameProvider } from '@/components/editor/CodeRenameOffer';
import PlaceholderManager from './PlaceholderManager';

/**
 * The placeholder panel's own wiring to the rename offer. Code reaches a placeholder by its path, so the
 * field has to name which entry moved: without that the offer can only match a bare name, and Molly's
 * `Hair` and the world's `Hair` are the same word.
 */

const molly: PlaceholderOwnerRef = { kind: 'entity', id: 'e1', name: 'Molly' };

const store: { list: Placeholder[]; stats: Stat[]; rerender: () => void } = {
  list: [],
  stats: [],
  rerender: () => {},
};

const scoped = () => store.list.find((entry) => entry.id === 'scoped')!;

vi.mock('@/contexts/PlaceholderStoreContext', () => ({
  usePlaceholderStore: () => ({
    placeholders: store.list,
    setPlaceholders: vi.fn(),
    addPlaceholder: vi.fn(),
    updatePlaceholder: (next: Placeholder) => {
      store.list = store.list.map((entry) => (entry.id === next.id ? next : entry));
      store.rerender();
    },
    removePlaceholder: vi.fn(),
  }),
  usePlaceholderStoreOptional: () => null,
}));

vi.mock('@/contexts/GameDataContext', () => ({
  useGameDataOptional: () => ({
    stats: store.stats,
    traits: [],
    placeholders: store.list,
    placeholderOwners: new Map([['scoped', molly]]),
    updateStat: (next: Stat) => {
      store.stats = store.stats.map((entry) => (entry.id === next.id ? next : entry));
      store.rerender();
    },
  }),
  useGameData: () => ({ stats: store.stats, traits: [], placeholders: store.list }),
}));

const Harness = () => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return (
    <CodeRenameProvider>
      <PlaceholderManager placeholder={scoped()} />
      <button type="button">elsewhere</button>
    </CodeRenameProvider>
  );
};

beforeEach(() => {
  store.list = [
    { id: 'world', name: 'Hair', values: phValues(['bald']) },
    { id: 'scoped', name: 'Hair', values: phValues(['red']) },
  ];
  store.stats = [
    { id: 's1', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0,
      code: 'return placeholders.Molly.Hair.text.length + placeholders.Hair.text.length;' } as unknown as Stat,
  ];
});

describe('the placeholder panel’s rename offer', () => {
  it('rewrites the leaf of the renamed entry and leaves the world-level name of its own alone', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // The panel's Label carries no `for`, so the name box is found by the hint it shows when empty.
    const field = screen.getByPlaceholderText('e.g. Eye Color');
    await user.click(field);
    await user.clear(field);
    await user.paste('Mane');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.getByText(/names the placeholder “Hair” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.stats[0].code)
      .toBe('return placeholders.Molly.Mane.text.length + placeholders.Hair.text.length;');
  });
});
