import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DictionaryEditorModal from './DictionaryEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider } from '@/contexts/GameDataContext';
import type { Dictionary } from '@/types';

/**
 * What the library dictionary editor's entry panel puts on screen. It mounts the same panel the World Editor
 * does, but holds the chosen tab itself, so this is the second host the split has to hold up in.
 */

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

/** A book carrying a placeholder, so the palette bar the entries insert chips from is on screen too. */
const draft = {
  id: 'b1', name: 'Fen Lore', enabled: true,
  placeholders: [{ id: 'p1', name: 'Hair Color', values: [{ id: 'v1', text: 'copper' }] }],
  entries: [
    { id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.', secondaryKeys: ['scaled'] },
    { id: 'e2', name: 'Quiet Folk', key: ['reed'], value: 'They keep to the water.' },
  ],
} as unknown as Dictionary;

// The modal's own stores are isolated, but the tree reads the app-wide placeholder store its real host —
// MainMenu, inside the GameData provider — puts around it.
const open = (onClose = vi.fn()) => render(
  <SettingsProvider>
    <GameDataProvider>
      <DictionaryEditorModal dictionaryId={null} draft={draft} onClose={onClose} />
    </GameDataProvider>
  </SettingsProvider>,
);

const panelStrip = () => screen.queryByRole('tablist', { name: 'Entry Fields' });

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Entry Fields' })).getByRole('tab', { name });

// These tabs switch on mouseDown, not click.
const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectEntry = (name: string) => fireEvent.click(screen.getByText(name));

describe('the library dictionary editor’s entry panel', () => {
  it('offers the same two tabs, opening on Details', () => {
    open();
    selectEntry('Hostile Forces');
    expect(within(panelStrip()!).getAllByRole('tab').map((el) => el.textContent)).toEqual(['Details', 'Matching']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('shows the matching rules on Matching and nothing of them on Details', () => {
    open();
    selectEntry('Hostile Forces');
    expect(screen.queryByText('Always Inject')).toBeNull();
    expect(screen.queryByText('Secondary Keywords')).toBeNull();

    openPanelTab('Matching');
    expect(screen.getByText('Always Inject')).toBeInTheDocument();
    expect(screen.getByText('Secondary Keywords')).toBeInTheDocument();
    expect(screen.getByText('Scan Depth')).toBeInTheDocument();
    expect(screen.queryByText('Value')).toBeNull();
  });

  it('keeps the chosen tab when the author selects another entry', () => {
    open();
    selectEntry('Hostile Forces');
    openPanelTab('Matching');
    selectEntry('Quiet Folk');
    expect(panelTab('Matching')).toHaveAttribute('aria-selected', 'true');
  });

  it('puts the placeholder palette bar above the strip, so chips insert on either tab', () => {
    open();
    selectEntry('Hostile Forces');
    const palette = screen.getByRole('button', { name: 'Placeholders' });
    // Ahead of the strip in document order, which is what "above" means to the author.
    expect(palette.compareDocumentPosition(panelStrip()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the book its own panel with no strip', () => {
    // The modal opens with the book itself selected, so this is the panel an author lands on.
    open();
    expect(panelStrip()).toBeNull();
    expect(screen.getByPlaceholderText('Notes for you. The AI never sees them.')).toBeInTheDocument();
  });
});
