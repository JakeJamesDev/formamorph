import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddDictionaryModal from './AddDictionaryModal';
import type { Dictionary } from '@/types';

const meta = [
  { id: 'a', name: 'Alpha', entryCount: 2 },
  { id: 'b', name: 'Beta', entryCount: 1 },
];

const books: Record<string, Dictionary> = {
  a: { id: 'a', name: 'Alpha', entries: [{ id: 'a-e', name: 'E', key: 'k', value: 'v' }] },
  b: { id: 'b', name: 'Beta', entries: [{ id: 'b-e', name: 'E', key: 'k', value: 'v' }] },
};

const getDictionaryMetadata = vi.fn(() => Promise.resolve(meta));
const getDictionaryData = vi.fn((id: string) => Promise.resolve(books[id]));

vi.mock('@/services/DictionaryStorageService', () => ({
  default: {
    getDictionaryMetadata: () => getDictionaryMetadata(),
    getDictionaryData: (id: string) => getDictionaryData(id),
  },
}));

describe('AddDictionaryModal', () => {
  beforeEach(() => {
    getDictionaryMetadata.mockClear();
    getDictionaryData.mockClear();
  });

  it('lists the library dictionaries once open', async () => {
    render(<AddDictionaryModal open onOpenChange={() => {}} onAdd={() => {}} />);
    expect(await screen.findByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('disables Add until at least one is checked', async () => {
    render(<AddDictionaryModal open onOpenChange={() => {}} onAdd={() => {}} />);
    await screen.findByText('Alpha');
    const add = screen.getByText('Add').closest('button')!;
    expect(add.disabled).toBe(true);
    fireEvent.click(screen.getByText('Alpha'));
    expect(add.disabled).toBe(false);
  });

  it('adds every selected dictionary as a fresh-id copy', async () => {
    const onAdd = vi.fn();
    const onOpenChange = vi.fn();
    render(<AddDictionaryModal open onOpenChange={onOpenChange} onAdd={onAdd} />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
    const added = onAdd.mock.calls.map((c) => c[0] as Dictionary);
    expect(added.map((d) => d.name)).toEqual(['Alpha', 'Beta']);
    // Fresh ids — book and entries differ from the library original.
    expect(added[0].id).not.toBe('a');
    expect(added[0].entries[0].id).not.toBe('a-e');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
