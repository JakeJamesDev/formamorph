import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GameDataProvider } from '@/contexts/GameDataContext';
import { ItemEffectsFields } from './ItemEffectsFields';
import type { Item, ItemStatEffect } from '@/types';

// The provider initializes IndexedDB storage on mount; these tests read only the store.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const row = (id: string, timing: ItemStatEffect['timing'], over: Partial<ItemStatEffect> = {}): ItemStatEffect =>
  ({ id, statId: 'strength', facet: 'value', timing, amount: 2, op: 'add', ...over });
const item = (over: Partial<Item>): Item => ({
  id: 'i', name: 'Potion', traitEffects: [], equipRequires: [],
  statEffects: [row('a', 'owned'), row('b', 'consumed', { duration: { kind: 'time', hours: 2 } })], ...over,
});
const renderFields = (it: Item, apply = vi.fn()) => {
  render(<GameDataProvider><ItemEffectsFields item={it} apply={apply} /></GameDataProvider>);
  return apply;
};

describe('ItemEffectsFields — After Consumed', () => {
  it('shows an After Consumed row with its duration on a Consumable item', () => {
    renderFields(item({ consumable: true }));
    expect(screen.getAllByRole('combobox', { name: 'Timing' })).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Duration' })).toHaveTextContent('Hours');
    expect(screen.getByRole('spinbutton', { name: 'Duration Amount' })).toHaveValue(2);
  });

  it('shows it on an item with charges', () => {
    renderFields(item({ charges: 3 }));
    expect(screen.getByRole('combobox', { name: 'Duration' })).toBeInTheDocument();
  });

  it('hides an After Consumed row on an item that cannot be used, and keeps it stored', () => {
    const apply = renderFields(item({}));
    expect(screen.getAllByRole('combobox', { name: 'Timing' })).toHaveLength(1);
    expect(screen.queryByRole('combobox', { name: 'Duration' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Amount' }), { target: { value: '5' } });
    expect(apply.mock.calls[0][0].statEffects.map((r: ItemStatEffect) => [r.id, r.amount])).toEqual([['a', 5], ['b', 2]]);
  });

  it('writes a typed duration in story hours', () => {
    const apply = renderFields(item({ consumable: true }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Duration Amount' }), { target: { value: '3' } });
    expect(apply.mock.calls[0][0].statEffects[1].duration).toEqual({ kind: 'time', hours: 3 });
  });
});
