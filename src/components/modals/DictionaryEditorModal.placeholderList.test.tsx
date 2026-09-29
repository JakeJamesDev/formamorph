import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DictionaryEditorModal from './DictionaryEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider } from '@/contexts/GameDataContext';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary } from '@/types';

/** The library dictionary editor's Placeholders tab on the List Editor: search and a named add. */

vi.mock('@/services/DictionaryStorageService', () => ({
  default: { getDictionaryData: vi.fn(), storeDictionary: vi.fn().mockResolvedValue(undefined) },
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

const book = {
  id: 'b1', name: 'Fen Lore', enabled: true,
  placeholders: [
    { id: 'p1', name: 'Hair Color', values: phValues(['copper']) },
    { id: 'p2', name: 'Weather', values: phValues(['rain']) },
  ],
  entries: [{ id: 'e1', name: 'Quiet Folk', key: ['reed'], value: 'They keep to the water.' }],
} as unknown as Dictionary;

async function openPlaceholders() {
  render(
    <SettingsProvider>
      <GameDataProvider>
        <DictionaryEditorModal dictionaryId={null} draft={book} onClose={vi.fn()} />
      </GameDataProvider>
    </SettingsProvider>,
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Placeholders' }));
}

const panes = () => document.querySelector('[data-list-detail]')!.children;
const list = () => within(panes()[0] as HTMLElement);
const detail = () => within(panes()[1] as HTMLElement);
const searchBox = () => screen.getByPlaceholderText('Search or add new placeholders');

describe('the library dictionary Placeholders tab', () => {
  it('shows the toolbar, and the list beside the detail', async () => {
    await openPlaceholders();
    expect(list().getByRole('button', { name: 'Add Placeholder' })).toBeInTheDocument();
    expect(list().getByText('Weather')).toBeInTheDocument();
    expect(detail().getByText('Select a placeholder to edit it, or add one')).toBeInTheDocument();
  });

  it('lists the rows the search matches, and opens one', async () => {
    await openPlaceholders();
    await userEvent.type(searchBox(), 'hair');
    expect(list().queryByText('Weather')).toBeNull();
    await userEvent.click(list().getByText('Hair Color'));
    expect(detail().getByDisplayValue('Hair Color')).toBeInTheDocument();
  });

  it('names a new placeholder from the search text and puts it in the book', async () => {
    await openPlaceholders();
    await userEvent.type(searchBox(), 'Tide');
    await userEvent.click(screen.getByRole('button', { name: 'Add Placeholder' }));
    expect(searchBox()).toHaveValue('');
    expect(detail().getByDisplayValue('Tide')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const saved = vi.mocked(DictionaryStorageService.storeDictionary).mock.calls.at(-1)![0];
    expect(JSON.stringify(saved)).toContain('"name":"Tide"');
  });
});

/** The palette header's toggle, which names the section it opens. */
const paletteIn = (pane: ReturnType<typeof within>) => pane.queryByRole('button', { name: /^Placeholders/ });

describe("the library dictionary editor's placeholder palette", () => {
  it('tops the detail pane on the Placeholders tab, with nothing selected, and never the list', async () => {
    await openPlaceholders();
    expect(paletteIn(detail())).toBeInTheDocument();
    expect(paletteIn(list())).toBeNull();
  });

  it('tops the detail pane on the Dictionary tab before an entry is open, and stays there once one is', async () => {
    await openPlaceholders();
    await userEvent.click(screen.getByRole('tab', { name: 'Dictionary' }));
    expect(paletteIn(detail())).toBeInTheDocument();
    expect(paletteIn(list())).toBeNull();
    await userEvent.click(list().getByText('Quiet Folk'));
    expect(paletteIn(detail())).toBeInTheDocument();
  });
});
