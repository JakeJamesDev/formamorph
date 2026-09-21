import { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DictionaryEditorModal from './DictionaryEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { worldFixture } from '@/test/gamePanels';
import { EditorModeContext } from '@/lib/editorMode';
import type { Dictionary } from '@/types';

/** Where the library dictionary editor puts the book and its entries: the book on Overview, entries alone
 *  in the Dictionary tab's tree. */

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

/** The Foreground entry comes first in the array, but the tree shows the Background one first. */
const book: Dictionary = {
  id: 'b1', name: 'Fen Lore', description: 'Marsh notes', enabled: true,
  entries: [
    { id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.' },
    { id: 'e2', name: 'Quiet Folk', key: ['reed'], value: 'They keep to the water.', position: 'before' },
  ],
};

const emptyBook: Dictionary = { ...book, entries: [] };

/** A loaded world whose stat code names the book, so a rename that reached the world would show. */
const statCode = 'placeholders["Fen Lore"].Mood.text';
const world = worldFixture({
  stats: [{ id: 's1', name: 'Calm', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [], code: statCode }],
});

function WorldProbe() {
  const { loadWorldData, stats } = useGameData();
  useEffect(() => { loadWorldData(world); }, [loadWorldData]);
  return <div data-testid="world-stat-code">{stats.map((s) => s.code).join('|')}</div>;
}

// The real host, MainMenu, mounts the modal inside the GameData provider.
const open = async (draft: Dictionary = book) => {
  render(
    <SettingsProvider>
      <GameDataProvider>
        <WorldProbe />
        <DictionaryEditorModal dictionaryId={null} draft={draft} onClose={vi.fn()} />
      </GameDataProvider>
    </SettingsProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('world-stat-code')).toHaveTextContent(statCode));
};

/** The list half of the split: the entry tree and its + row. */
const entryList = () => document.querySelector('[data-list-detail]')!.children[0] as HTMLElement;
const detail = () => document.querySelector('[data-list-detail]')!.children[1] as HTMLElement;
const topTab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}$`) });

describe('the library dictionary editor’s Dictionary tab', () => {
  it('opens on Dictionary with the first entry the tree shows selected', async () => {
    await open();
    expect(topTab('Dictionary')).toHaveAttribute('aria-selected', 'true');
    expect(within(detail()).getByText('They keep to the water.')).toBeInTheDocument();
  });

  it('lists the entries at the top level, with no book row', async () => {
    await open();
    expect(within(entryList()).getByText('Hostile Forces')).toBeInTheDocument();
    expect(within(entryList()).getByText('Quiet Folk')).toBeInTheDocument();
    expect(within(entryList()).queryByText('Fen Lore')).toBeNull();
    expect(within(entryList()).queryByRole('button', { name: 'Delete dictionary' })).toBeNull();
  });

  it('adds an entry with the + and selects it', async () => {
    await open();
    fireEvent.click(within(entryList()).getByRole('button', { name: 'Add entry' }));
    expect(within(entryList()).getByText('Untitled')).toBeInTheDocument();
    expect(within(detail()).queryByText('They keep to the water.')).toBeNull();
    expect(within(detail()).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('duplicates and deletes entries from the tree', async () => {
    await open();
    fireEvent.click(within(entryList()).getAllByRole('button', { name: 'Duplicate' })[0]);
    expect(within(entryList()).getAllByText(/Quiet Folk/)).toHaveLength(2);
    for (const button of within(entryList()).getAllByRole('button', { name: /^Delete$/ })) fireEvent.click(button);
    expect(within(entryList()).queryByText(/Quiet Folk/)).toBeNull();
    expect(within(entryList()).queryByText('Hostile Forces')).toBeNull();
  });

  it('selects nothing in an empty book and shows a hint beside the +', async () => {
    await open(emptyBook);
    const toolbar = within(entryList()).getByRole('button', { name: 'Add entry' }).parentElement!;
    expect(within(toolbar).getByText(/No entries yet/)).toBeInTheDocument();
    expect(within(detail()).getByText('Select an entry to edit it')).toBeInTheDocument();
  });

  it('opens on Dictionary again after the author left it on another tab', async () => {
    const { rerender } = render(
      <SettingsProvider>
        <GameDataProvider>
          <DictionaryEditorModal dictionaryId={null} draft={book} onClose={vi.fn()} />
        </GameDataProvider>
      </SettingsProvider>,
    );
    await userEvent.setup().click(topTab('Overview'));
    rerender(
      <SettingsProvider>
        <GameDataProvider>
          <DictionaryEditorModal dictionaryId={null} draft={{ ...book }} onClose={vi.fn()} />
        </GameDataProvider>
      </SettingsProvider>,
    );
    expect(topTab('Dictionary')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('the library dictionary editor’s Overview', () => {
  const openOverview = async () => {
    await open();
    await userEvent.setup().click(topTab('Overview'));
  };

  it('holds Author above Tags, Cover Image, Name, and Description without Enabled', async () => {
    await openOverview();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Cover Image')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Fen Lore');
    expect(screen.getByPlaceholderText('Notes for you, not injected into the prompt')).toHaveValue('Marsh notes');
    const author = screen.getByRole('textbox', { name: 'Author' });
    expect(author).toHaveValue('');
    expect(author.compareDocumentPosition(screen.getByText('Tags')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Enabled/ })).toBeNull();
  });

  it('keeps Enabled absent when a World Editor in Simple mode opens it', async () => {
    render(
      <SettingsProvider>
        <GameDataProvider>
          <EditorModeContext.Provider value={{ mode: 'simple', advanced: false, setMode: () => {} }}>
            <DictionaryEditorModal dictionaryId={null} draft={book} onClose={vi.fn()} />
          </EditorModeContext.Provider>
        </GameDataProvider>
      </SettingsProvider>,
    );
    await userEvent.setup().click(topTab('Overview'));
    expect(screen.queryByRole('checkbox', { name: /Enabled/ })).toBeNull();
  });

  it('shows none of the World Editor book panel', async () => {
    await openOverview();
    expect(screen.queryByText(/Add one with the \+ on this dictionary/)).toBeNull();
    expect(screen.queryByText(/Placeholders of this dictionary/)).toBeNull();
  });

  it('renames the book, raises no offer, and changes no stat of the world', async () => {
    await openOverview();
    const user = userEvent.setup();
    const name = screen.getByLabelText('Name');
    await user.click(name);
    await user.clear(name);
    await user.type(name, 'Bog Lore');
    await user.tab();
    expect(screen.getByRole('dialog', { name: 'Bog Lore' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByTestId('world-stat-code')).toHaveTextContent(statCode);
  });
});
