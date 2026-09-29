import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import DictionaryEditorModal from './DictionaryEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider } from '@/contexts/GameDataContext';
import type { Dictionary } from '@/types';

/** The library dictionary editor's entry search: a flat list of matching entries, with bare labels. */

vi.mock('@/services/DictionaryStorageService', () => ({
  default: { getDictionaryData: vi.fn(), storeDictionary: vi.fn() },
}));

// The GameData provider opens IndexedDB on mount, which jsdom has none of.
vi.mock('@/services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

// jsdom has no matchMedia; SettingsProvider reads it on mount for the theme.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const book: Dictionary = {
  id: 'b1', name: 'Fen Lore', enabled: true,
  entries: [
    { id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.' },
    { id: 'e2', name: 'Quiet Folk', key: ['reed'], value: 'They keep to the water.', position: 'before' },
    { id: 'e3', name: '', key: ['lantern'], value: 'Burns blue.' },
  ],
};

const open = async () => {
  render(
    <SettingsProvider>
      <GameDataProvider>
        <DictionaryEditorModal dictionaryId={null} draft={book} onClose={vi.fn()} />
      </GameDataProvider>
    </SettingsProvider>,
  );
  await waitFor(() => expect(screen.getByPlaceholderText('Search or add new entries')).toBeInTheDocument());
};

const entryList = () => document.querySelector('[data-list-detail]')!.children[0] as HTMLElement;
const detail = () => document.querySelector('[data-list-detail]')!.children[1] as HTMLElement;
const search = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Search or add new entries'), { target: { value: term } });

describe('the library dictionary editor’s entry search', () => {
  it('lists only the matching entries, by the label their row shows', async () => {
    await open();
    search('lant');
    expect(within(entryList()).getByRole('button', { name: 'Select lantern' })).toBeInTheDocument();
    expect(within(entryList()).queryByText('Hostile Forces')).toBeNull();
    search('zzz');
    expect(within(entryList()).getByText('No entries match “zzz”.')).toBeInTheDocument();
  });

  it('opens the entry a search row selects', async () => {
    await open();
    search('Hostile');
    fireEvent.click(within(entryList()).getByText('Hostile Forces'));
    expect(within(detail()).getByText('A big lizard.')).toBeInTheDocument();
  });

  it('deletes an entry from its search row', async () => {
    await open();
    search('Quiet');
    fireEvent.click(within(entryList()).getByRole('button', { name: 'Delete' }));
    search('');
    expect(within(entryList()).queryByText('Quiet Folk')).toBeNull();
    expect(within(entryList()).getByText('Hostile Forces')).toBeInTheDocument();
  });

  it('names a new entry from the search text', async () => {
    await open();
    search('Bog Lights');
    fireEvent.click(within(entryList()).getByRole('button', { name: 'Add entry' }));
    expect(within(entryList()).getByText('Bog Lights')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search or add new entries')).toHaveValue('');
  });

  it('adds an Untitled entry from an empty box', async () => {
    await open();
    fireEvent.click(within(entryList()).getByRole('button', { name: 'Add entry' }));
    expect(within(entryList()).getByText('Untitled')).toBeInTheDocument();
  });

  it('keeps a folded zone folded through a search', async () => {
    await open();
    fireEvent.click(within(entryList()).getByRole('button', { name: /Background/ }));
    expect(within(entryList()).queryByText('Quiet Folk')).toBeNull();
    search('lant');
    search('');
    expect(within(entryList()).queryByText('Quiet Folk')).toBeNull();
    expect(within(entryList()).getByText('Hostile Forces')).toBeInTheDocument();
  });
});
