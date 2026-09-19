import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DictionaryEditorModal from './DictionaryEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import type { PlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import { worldFixture } from '@/test/gamePanels';
import type { Dictionary } from '@/types';

/**
 * The library dictionary editor reads and writes its own book's placeholders, never the world's that the
 * app-wide store around it holds. The modal mounts inside the real GameData provider, as MainMenu mounts it.
 */

const stores = vi.hoisted(() => [] as PlaceholderStore[]);

// Records every store a provider is handed, so a test can tell whether the modal's own store kept its instance.
vi.mock('@/contexts/PlaceholderStoreContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/PlaceholderStoreContext')>();
  return {
    ...actual,
    PlaceholderStoreProvider: (props: Parameters<typeof actual.PlaceholderStoreProvider>[0]) => {
      stores.push(props.value);
      return actual.PlaceholderStoreProvider(props);
    },
  };
});

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

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

/** A book whose first entry is named by its own placeholder, and which carries a shared one besides. */
const draft = {
  id: 'b1', name: 'Fen Lore', enabled: true,
  placeholders: [{ id: 'p1', name: 'Hair Color', values: phValues(['copper']) }],
  sharedPlaceholders: [{ id: 's1', name: 'Weather', values: phValues(['rain']) }],
  entries: [
    { id: 'e1', name: `${chip('p1')} Folk`, key: ['reed'], value: 'They keep to the water.' },
    { id: 'e2', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.' },
  ],
} as unknown as Dictionary;

/** The loaded world holds a placeholder of the same id under another name. */
const world = worldFixture({ placeholders: [{ id: 'p1', name: 'World Weather', values: phValues(['sun']) }] });

/** Loads the world and shows its placeholder names, beside the modal and outside it. */
function WorldProbe() {
  const { loadWorldData, placeholders } = useGameData();
  useEffect(() => { loadWorldData(world); }, [loadWorldData]);
  return <div data-testid="world-placeholders">{(placeholders ?? []).map((p) => p.name).join(',')}</div>;
}

const open = async () => {
  render(
    <SettingsProvider>
      <GameDataProvider>
        <WorldProbe />
        <DictionaryEditorModal dictionaryId={null} draft={draft} onClose={vi.fn()} />
      </GameDataProvider>
    </SettingsProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('world-placeholders')).toHaveTextContent('World Weather'));
};

/** The stores the modal handed out: the world's own store carries the world's lists, the modal's none. */
const modalStores = () => stores.filter((s) => !s.lists);

beforeEach(() => { stores.length = 0; });

describe('the library dictionary editor’s own placeholder store', () => {
  it('labels an entry’s chip with the book’s placeholder, not the world’s', async () => {
    await open();
    // The modal opens on the book's own panel, so the tree is the one place the entry's name shows.
    expect(screen.getByText(/Hair Color/)).toBeInTheDocument();
    expect(screen.queryByText(/World Weather/, { ignore: '[data-testid="world-placeholders"]' })).toBeNull();
  });

  it('keeps the store instance across a keystroke in an entry value', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByText('Hostile Forces'));
    await user.click(screen.getByText('A big lizard.'));
    const before = modalStores().length;
    const settled = modalStores().at(-1);
    await user.keyboard('x');
    // jsdom puts Lexical's caret at the head of the clicked text.
    expect(screen.getByText('xA big lizard.')).toBeInTheDocument();
    // The modal rendered again for the keystroke, and handed out the same store each time.
    const after = modalStores().slice(before);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((s) => s === settled)).toBe(true);
  });

  it('puts a placeholder made from an entry field in the book, and leaves the world alone', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByText('Hostile Forces'));
    await user.click(screen.getByLabelText('Name'));
    await user.keyboard('{{Southern');
    // The menu opts back into pointer events with a class jsdom has no stylesheet for; it acts on mousedown.
    fireEvent.mouseDown(await screen.findByTestId('chip-typeahead-create'));

    await user.click(screen.getByRole('tab', { name: 'Placeholders' }));
    expect(await screen.findByRole('button', { name: 'Southern' })).toBeInTheDocument();
    await act(async () => {});
    expect(screen.getByTestId('world-placeholders')).toHaveTextContent(/^World Weather$/);
  });

  it('binds no owner’s section: the store has no world lists', async () => {
    await open();
    expect(modalStores().length).toBeGreaterThan(0);
    expect(screen.queryByText(/Placeholders of this dictionary/)).toBeNull();
  });
});
