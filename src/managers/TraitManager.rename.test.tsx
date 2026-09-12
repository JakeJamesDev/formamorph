import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder, Stat, Trait } from '@/types';
import { CodeRenameProvider } from '@/components/editor/CodeRenameOffer';
import TraitManager from './TraitManager';

/**
 * The panel's own wiring to the rename offer: a trait's name field has to hand the offer the name *code*
 * reads, not the text in the field. Whether the offer then rewrites correctly is covered beside the offer.
 */

const chip = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'v-p1' });
const beast: Placeholder = { id: 'p1', name: 'Beast', values: phValues(['Wolf', 'Bear']) };

const store: { trait: Trait; stats: Stat[]; rerender: () => void } = {
  trait: { id: 't1', name: `${chip} Fury`, statChanges: [] } as unknown as Trait,
  stats: [],
  rerender: () => {},
};

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    stats: store.stats,
    traits: [store.trait],
    traitGroups: [],
    locations: [],
    placeholders: [beast],
    updateTrait: (next: Trait) => {
      store.trait = next;
      store.rerender();
    },
  }),
  useGameDataOptional: () => ({
    stats: store.stats,
    updateStat: (next: Stat) => {
      store.stats = store.stats.map((entry) => (entry.id === next.id ? next : entry));
      store.rerender();
    },
  }),
}));

// The real name field is a Lexical editor; a plain input over the same value and the same commit handlers
// is what this test drives.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { label: string; value: string }) => <input readOnly aria-label={props.label} value={props.value} />,
  PlaceholderNameField: (props: {
    value: string;
    ariaLabel: string;
    onChange: (next: string) => void;
    onFocus: () => void;
    onBlur: () => void;
  }) => (
    <input
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
    />
  ),
}));

const Harness = () => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return (
    <CodeRenameProvider>
      <TraitManager trait={store.trait} onOpenTrait={() => {}} tab="details" onTabChange={() => {}} />
      <button type="button">elsewhere</button>
    </CodeRenameProvider>
  );
};

beforeEach(() => {
  store.trait = { id: 't1', name: `${chip} Fury`, statChanges: [] } as unknown as Trait;
  store.stats = [
    { id: 's1', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0,
      code: `return traits['Beast Fury'].enabled ? 2 : 1;` } as unknown as Stat,
  ];
});

describe('the trait panel’s rename offer', () => {
  it('asks about the name code reads, and rewrites it, when a chip-bearing name changes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText('Name');
    await user.click(field);
    await user.clear(field);
    await user.paste(`${chip} Rage`);
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.getByText(/names the trait “Beast Fury” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.stats[0].code).toBe(`return traits['Beast Rage'].enabled ? 2 : 1;`);
  });
});
