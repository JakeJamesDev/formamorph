import { useEffect, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import DictionaryEditorModal from './DictionaryEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider, NoWorld, useGameData } from '@/contexts/GameDataContext';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { usePlacementLetters } from '@/contexts/PlacementLettersContext';
import { EMPTY_LETTERS } from '@/lib/placementLetters';
import { CodeRenameProvider } from '@/components/editor/CodeRenameOffer';
import EntityStorageService from '@/services/EntityStorageService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import { phValueId, phValues } from '@/test/placeholderValues';
import { worldFixture } from '@/test/gamePanels';
import type { Dictionary, Entity, Placeholder, Stat, World } from '@/types';

/**
 * A library editor has no world behind it, even where the app has one loaded around it. Each modal renders
 * inside a real GameData provider holding a world whose trait, location, and stat all pin the library
 * item's placeholder. No name from that world may show, and no edit may reach the world's writers.
 */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), storeEntity: vi.fn().mockResolvedValue(undefined) },
}));
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

/** The library item's placeholders: Town's first value carries a pin onto Mood. */
const itemPlaceholders = (): Placeholder[] => [
  {
    id: 'town', name: 'Town',
    values: [{ ...phValues(['Sedge'])[0], pins: [{ placeholderId: 'mood', value: 'calm', valueId: phValueId('calm') }] }, ...phValues(['Marrow'])],
  },
  { id: 'mood', name: 'Mood', values: phValues(['calm', 'wary']) },
];

const worldPin = [{ placeholderId: 'town', value: 'Marrow', valueId: phValueId('Marrow') }];

/** A world whose trait, location, and stat band each pin the library item's Town. */
const world = (extra: Partial<World> = {}) => worldFixture({
  traits: [{ id: 't1', name: 'Brave Heart', description: '', placeholderPins: worldPin }],
  locations: [{ id: 'l1', name: 'Harbor Gate', description: '', placeholderPins: worldPin }],
  stats: [{
    id: 's1', name: 'Grit', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0,
    descriptors: [{ id: 'd1', threshold: 20, description: 'shaken', placeholderPins: worldPin }],
  }],
  placeholders: [{ id: 'sky', name: 'Sky', values: phValues(['gray']) }],
  ...extra,
} as unknown as Partial<World>);

const WORLD_NAMES = /Brave Heart|Harbor Gate|Grit|Sky/;

/** Loads the world, and shows the pins its sources hold, beside the modal and outside it. */
function WorldProbe({ load }: { load: World }) {
  const { loadWorldData, traits, locations, stats } = useGameData();
  useEffect(() => { loadWorldData(load); }, [loadWorldData, load]);
  const pins = JSON.stringify([
    traits.map((t) => t.placeholderPins), locations.map((l) => l.placeholderPins),
    stats.map((s) => [s.code, s.descriptors?.map((d) => d.placeholderPins)]),
  ]);
  return <div data-testid="world-probe" data-names={traits.map((t) => t.name).join(',')}>{pins}</div>;
}

const renderInWorld = async (load: World, modal: ReactNode) => {
  render(
    <SettingsProvider>
      <GameDataProvider>
        <CodeRenameProvider>
          <WorldProbe load={load} />
          {modal}
        </CodeRenameProvider>
      </GameDataProvider>
    </SettingsProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('world-probe')).toHaveAttribute('data-names', 'Brave Heart'));
  return screen.getByTestId('world-probe').textContent;
};

/** Text anywhere on the page except the probe. */
const pageText = () => {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelector('[data-testid="world-probe"]')?.remove();
  return clone.textContent ?? '';
};

/** Opens Town on the Placeholders tab and checks every pin surface there. */
const checkPinSurfaces = async (worldBefore: string | null) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: 'Placeholders' }));
  // The tree row, not the palette's chip button of the same name.
  await user.click(within(screen.getByRole('dialog')).getAllByText('Town').find((el) => !el.closest('button'))!);
  await screen.findByRole('button', { name: /Pins for Sedge/ });

  // No section lists the world's pins onto Town, so nothing offers a trait, location, or stat to pin from.
  expect(screen.queryByText('Placeholder Pins')).toBeNull();
  expect(screen.queryByLabelText('Pin Kind')).toBeNull();
  expect(pageText()).not.toMatch(WORLD_NAMES);

  // The value's own pin shows and names the item's placeholder, not the world's.
  await user.click(screen.getByRole('button', { name: /Pins for Sedge/ }));
  expect(await screen.findByText('Placeholder Pins')).toBeInTheDocument();
  expect(pageText()).toMatch(/Mood/);
  expect(pageText()).not.toMatch(WORLD_NAMES);
  await user.keyboard('{Escape}');

  // Every pin the page offers to remove: none of them is the world's.
  for (const remove of screen.queryAllByRole('button', { name: 'Remove Pin' })) await user.click(remove);
  // An edit to the item: drop Marrow, the value the world's pins name.
  await user.click(screen.getByRole('radio', { name: 'Multiline' }));
  await user.click(screen.getByRole('button', { name: 'Remove value 2' }));
  await act(async () => {});
  expect(screen.getByTestId('world-probe').textContent).toBe(worldBefore);
};

beforeEach(() => { vi.clearAllMocks(); });

describe('the no-world boundary', () => {
  it.each([
    ['useGameData', useGameData],
    ['useDictionaryStore', useDictionaryStore],
    ['usePlaceholderStore', usePlaceholderStore],
  ])('still fails a widget that requires the world through %s', (name, hook) => {
    const NeedsWorld = () => { hook(); return null; };
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<GameDataProvider><NoWorld><NeedsWorld /></NoWorld></GameDataProvider>))
        .toThrow(`${name} must be used within`);
    } finally {
      quiet.mockRestore();
    }
  });

  it('letters no chip from the world', () => {
    let letters: ReturnType<typeof usePlacementLetters> | null = null;
    const ReadLetters = () => { letters = usePlacementLetters(); return null; };
    render(<GameDataProvider><NoWorld><ReadLetters /></NoWorld></GameDataProvider>);
    expect(letters).toBe(EMPTY_LETTERS);
  });
});

describe('the library entity editor with a world loaded around it', () => {
  const draft = { id: 'e1', name: 'Maren', placeholders: itemPlaceholders() } as unknown as Entity;

  it('shows no world name in its pin surfaces, writes nothing to the world, and saves its own pins', async () => {
    const before = await renderInWorld(world(), <EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} />);
    await checkPinSurfaces(before);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(EntityStorageService.storeEntity).toHaveBeenCalled());
    const saved = vi.mocked(EntityStorageService.storeEntity).mock.calls[0][0].data as Entity;
    expect(saved.placeholders?.find((p) => p.id === 'town')?.values[0].pins).toEqual(itemPlaceholders()[0].values[0].pins);
  });
});

describe('the library dictionary editor with a world loaded around it', () => {
  const draft = {
    id: 'b1', name: 'Fen', enabled: true, placeholders: itemPlaceholders(),
    entries: [{ id: 'e1', name: 'Reeds', key: ['reed'], value: 'They keep to the water.' }],
  } as unknown as Dictionary;

  it('shows no world name in its pin surfaces, writes nothing to the world, and saves its own pins', async () => {
    const before = await renderInWorld(world(), <DictionaryEditorModal dictionaryId={null} draft={draft} onClose={vi.fn()} />);
    await checkPinSurfaces(before);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(DictionaryStorageService.storeDictionary).toHaveBeenCalled());
    const saved = vi.mocked(DictionaryStorageService.storeDictionary).mock.calls[0][0].data as Dictionary;
    expect(saved.placeholders?.find((p) => p.id === 'town')?.values[0].pins).toEqual(itemPlaceholders()[0].values[0].pins);
  });

  it('asks the world’s rename offer nothing when the book is renamed', async () => {
    // The world holds the same book, owning a placeholder its stat code reaches through the book's name.
    const load = world({
      dictionaries: [{ id: 'b1', name: 'Fen', enabled: true, entries: [], placeholders: [{ id: 'hair', name: 'Hair', values: phValues(['red']) }] }],
      stats: [{
        id: 's1', name: 'Grit', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0,
        code: 'return placeholders.Fen.Hair.text.length;',
      } as unknown as Stat],
    } as unknown as Partial<World>);
    const before = await renderInWorld(load, <DictionaryEditorModal dictionaryId={null} draft={draft} onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    const field = screen.getAllByLabelText('Name').find((el) => (el as HTMLInputElement).value === 'Fen')!;
    await user.click(field);
    await user.clear(field);
    // Committed by blur: an Enter would also press the dialog's focused Leave Code and hide the offer.
    await user.type(field, 'Marsh');
    await user.tab();
    await act(async () => {});

    expect(screen.queryByText('Update Code References')).toBeNull();
    expect(screen.getByTestId('world-probe').textContent).toBe(before);
  });
});
