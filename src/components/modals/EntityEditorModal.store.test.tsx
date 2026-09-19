import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import type { PlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { phValues } from '@/test/placeholderValues';
import { worldFixture } from '@/test/gamePanels';
import type { Entity } from '@/types';

/** The library entity editor hands its whole body one store over the character's own pool, and keeps it. */

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

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), storeEntity: vi.fn() },
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

/** A character that owns one placeholder and carries a shared one besides. */
const draft = {
  id: 'e1',
  name: 'Maren',
  placeholders: [{ id: 'town', name: 'Town', values: phValues(['Sedge', 'Marrow']) }],
  sharedPlaceholders: [{ id: 'weather', name: 'Weather', values: phValues(['rain']) }],
} as unknown as Entity;

/** The loaded world holds a placeholder of its own. */
const world = worldFixture({ placeholders: [{ id: 'sky', name: 'Sky', values: phValues(['gray']) }] });

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
        <EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} />
      </GameDataProvider>
    </SettingsProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('world-placeholders')).toHaveTextContent('Sky'));
};

/** The stores the modal handed out: the world's own store carries the world's lists, the modal's none. */
const modalStores = () => stores.filter((s) => !s.lists);

beforeEach(() => { stores.length = 0; });

describe('the library entity editor’s own placeholder store', () => {
  it('keeps the store instance across a keystroke in an entity field', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Name'));
    const before = modalStores().length;
    const settled = modalStores().at(-1);
    await user.keyboard('x');
    // jsdom puts Lexical's caret at the head of the clicked text.
    expect(screen.getByLabelText('Name')).toHaveTextContent('xMaren');
    // The modal rendered again for the keystroke, and handed out the same store each time.
    const after = modalStores().slice(before);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((s) => s === settled)).toBe(true);
  });

  it('puts a placeholder made from an entity field in the character, and leaves the world alone', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Name'));
    await user.keyboard('{{Southern');
    // The menu opts back into pointer events with a class jsdom has no stylesheet for; it acts on mousedown.
    fireEvent.mouseDown(await screen.findByTestId('chip-typeahead-create'));

    await user.click(screen.getByRole('tab', { name: 'Placeholders' }));
    expect(await screen.findByRole('button', { name: 'Southern' })).toBeInTheDocument();
    await act(async () => {});
    expect(screen.getByTestId('world-placeholders')).toHaveTextContent(/^Sky$/);
  });
});
