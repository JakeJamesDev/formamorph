import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { phValues } from '@/test/placeholderValues';
import type { Entity, Placeholder, Stat } from '@/types';
import type { PlaceholderOwnerRef } from '@/lib/placeholderHomes';
import { CodeRenameProvider } from '@/components/editor/CodeRenameOffer';
import EntityManager from './EntityManager';

/**
 * The entity panel's own wiring to the rename offer. An entity that owns placeholders opens a path, so its
 * name field has to report a commit the way a stat's and a trait's do. Whether the offer then rewrites the
 * right segment is covered beside the offer.
 */

const hair: Placeholder = { id: 'h1', name: 'Hair', values: phValues(['red']) };
const molly = (name: string): PlaceholderOwnerRef => ({ kind: 'entity', id: 'e1', name });

const store: { entity: Entity; stats: Stat[]; rerender: () => void } = {
  entity: { id: 'e1', name: 'Molly' } as unknown as Entity,
  stats: [],
  rerender: () => {},
};

const world = () => ({
  entities: [store.entity],
  locations: [],
  stats: store.stats,
  traits: [],
  placeholders: [hair],
  placeholderOwners: new Map([['h1', molly(store.entity.name)]]),
  placementLetters: new Map(),
  updateEntity: (next: Entity) => {
    store.entity = next;
    store.rerender();
  },
  updateStat: (next: Stat) => {
    store.stats = store.stats.map((entry) => (entry.id === next.id ? next : entry));
    store.rerender();
  },
});

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => world(),
  useGameDataOptional: () => world(),
}));

// The real name field is a Lexical editor; a plain input over the same value and the same commit handlers
// is what this test drives. The other groups on the tab are stubbed: none of them holds a name.
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

vi.mock('./ImageTagsField', () => ({
  ImageGallery: () => null,
  ImageTags: () => null,
  ImageWidget: () => null,
}));

vi.mock('./EntityFields', async (importOriginal) => {
  const real = await importOriginal<typeof import('./EntityFields')>();
  return {
    ...real,
    EntityImageWidget: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    EntityDescriptionFields: () => null,
    EntityLocationsField: () => null,
    EntityModelField: () => null,
  };
});

const Harness = () => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return (
    <CodeRenameProvider>
      <EntityManager entity={store.entity} tab="profile" onTabChange={() => {}} />
      <button type="button">elsewhere</button>
    </CodeRenameProvider>
  );
};

beforeEach(() => {
  store.entity = { id: 'e1', name: 'Molly' } as unknown as Entity;
  store.stats = [
    { id: 's1', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0,
      code: `return placeholders.Molly.Hair.text.length;` } as unknown as Stat,
  ];
});

describe('the entity panel’s rename offer', () => {
  it('offers to rewrite the owner segment of every path through the entity', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText('Name');
    await user.click(field);
    await user.clear(field);
    await user.paste('Maud');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    // "entity", not "placeholder": the rename is reached through the `placeholders` map, but the row the
    // author renamed is the entity, and naming the wrong one sends them looking in the wrong tab.
    expect(screen.getByText(/names the entity “Molly” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.stats[0].code).toBe('return placeholders.Maud.Hair.text.length;');
  });
});
