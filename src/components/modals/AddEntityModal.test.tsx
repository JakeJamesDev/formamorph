import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddEntityModal from './AddEntityModal';
import type { Entity } from '@/types';

const meta = [
  { id: 'a', name: 'Alpha', image: 'data:image/png;base64,AAA' },
  { id: 'b', name: 'Beta' },
];

const entities: Record<string, Entity> = {
  a: { id: 'a', name: 'Alpha' } as Entity,
  b: { id: 'b', name: 'Beta' } as Entity,
};

const getEntityMetadata = vi.fn(() => Promise.resolve(meta));
const getEntityData = vi.fn((id: string) => Promise.resolve(entities[id]));

vi.mock('@/services/EntityStorageService', () => ({
  default: {
    getEntityMetadata: () => getEntityMetadata(),
    getEntityData: (id: string) => getEntityData(id),
  },
}));

describe('AddEntityModal', () => {
  beforeEach(() => {
    getEntityMetadata.mockClear();
    getEntityData.mockClear();
  });

  it('lists the library characters once open', async () => {
    render(<AddEntityModal open onOpenChange={() => {}} onAdd={() => {}} />);
    expect(await screen.findByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    // Portrait renders for the entity that has one, User fallback otherwise.
    expect(screen.getByAltText('Alpha')).toBeTruthy();
  });

  it('disables Add until at least one is checked', async () => {
    render(<AddEntityModal open onOpenChange={() => {}} onAdd={() => {}} />);
    await screen.findByText('Alpha');
    const add = screen.getByText('Add').closest('button')!;
    expect(add.disabled).toBe(true);
    fireEvent.click(screen.getByText('Alpha'));
    expect(add.disabled).toBe(false);
  });

  it('adds every selected character as a fresh-id copy', async () => {
    const onAdd = vi.fn();
    const onOpenChange = vi.fn();
    render(<AddEntityModal open onOpenChange={onOpenChange} onAdd={onAdd} />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
    const added = onAdd.mock.calls.map((c) => c[0] as Entity);
    expect(added.map((e) => e.name)).toEqual(['Alpha', 'Beta']);
    expect(added[0].id).not.toBe('a'); // fresh id, independent of the library original
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
