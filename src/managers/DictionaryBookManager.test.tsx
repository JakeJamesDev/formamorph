import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DictionaryBookManager from './DictionaryBookManager';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider } from '@/contexts/GameDataContext';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import type { Dictionary } from '@/types';

/** Which host gets the book's own Placeholders section: the world's store, and never a library book's own
 *  store, even with the app-wide world store around it. */

// The GameData provider opens IndexedDB on mount, which jsdom has none of.
vi.mock('@/services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

// jsdom has no matchMedia; SettingsProvider reads it on mount for the theme.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const book = { id: 'b1', name: 'Fen Lore', enabled: true, entries: [] } as unknown as Dictionary;

const open = (host: 'world' | 'library') => render(
  <SettingsProvider>
    <GameDataProvider>
      {host === 'world' ? (
        <DictionaryBookManager book={book} />
      ) : (
        // A library modal binds a store over the book's own list, the way its modal does.
        <PlaceholderStoreProvider value={placeholderStore([], () => {})}>
          <DictionaryBookManager book={book} />
        </PlaceholderStoreProvider>
      )}
    </GameDataProvider>
  </SettingsProvider>,
);

describe('the book panel’s own Placeholders section', () => {
  it('shows in a world host', () => {
    open('world');
    expect(screen.getByText(/Placeholders of this dictionary/)).toBeInTheDocument();
  });

  it('stays out of a library book’s own store', () => {
    open('library');
    expect(screen.queryByText(/Placeholders of this dictionary/)).toBeNull();
  });
});
