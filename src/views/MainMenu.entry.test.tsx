import { screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import WorldStorageService from '@/services/WorldStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import type { StoredWorldRecord } from '@/services/WorldStorageService';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { readDefaultPersona, readWorldPersona, setDefaultPersona } from '@/lib/personaPick';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
// WebGL rendering is outside the entry contract; Avatar's controls and handoff stay real.
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});
// The library grid sits behind the entry dialog and takes nothing from the draft, so it counts menu renders.
const gridRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/components/library/LibraryTileGrid', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/library/LibraryTileGrid')>();
  const { createElement } = await import('react');
  const LibraryTileGrid = ((props: Parameters<typeof real.LibraryTileGrid>[0]) => {
    gridRenders.count++;
    return createElement(real.LibraryTileGrid, props);
  }) as typeof real.LibraryTileGrid;
  return { ...real, LibraryTileGrid };
});

/** Click Finalize Avatar once the library's models load: the button stays disabled until then. */
async function finalize() {
  const button = await screen.findByRole('button', { name: 'Finalize Avatar' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

const world = (avatar = false): StoredWorldRecord => ({
  id: 'entry-world', name: 'Entry World',
  data: {
    version: __APP_VERSION__,
    worldOverview: { name: 'Entry World', description: '', author: '', systemPrompt: '', tags: [], ...(avatar ? { legacyVrmFallback: { kind: 'default' } } : {}) },
    stats: [], entities: [], statUpdates: [],
    traits: [
      { id: 'default', name: 'Default trait', isDefault: true, statChanges: [] },
      { id: 'extra', name: 'Extra trait', groupId: 'group', statChanges: [] },
    ],
    traitGroups: [{ id: 'group', name: 'Other traits' }],
    locations: [
      { id: 'harbor', name: 'Harbor', isStarting: true },
      { id: 'hill', name: 'Hill', isStarting: true },
    ],
    dictionaries: [
      { id: 'shared', name: 'World book', enabled: true, entries: [] },
      { id: 'off', name: 'Disabled book', enabled: false, entries: [] },
    ],
  },
});

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  await WorldStorageService.storeWorld(world());
  await EntityStorageService.storeEntity({
    id: 'companion', name: 'Companion',
    data: { id: 'companion', name: 'Companion', playerDescription: '', aiDescription: '', aiSummary: '' },
  });
  await DictionaryStorageService.storeDictionary({
    id: 'shared', name: 'Library book',
    data: {
      id: 'shared', name: 'Library book', enabled: true,
      entries: [{ id: 'library-entry', name: 'Library entry', key: ['note'], value: 'A note.' }],
    },
  });
});
const NO_PERSONA = { ref: { source: 'none' } };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function enter() {
  fireEvent.click(await screen.findByText('Entry World'));
  fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
  await screen.findByRole('dialog', { name: 'Enter Entry World' });
}

describe('the retained entry draft', () => {
  it('renders draft picks in the entry dialog without rendering the menu behind it', async () => {
    renderMainMenu();
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    const before = gridRenders.count;
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    expect(screen.getByRole('radio', { name: 'Hill' })).toBeChecked();
    expect(before).toBeGreaterThan(0);
    expect(gridRenders.count).toBe(before);
  });

  it('leaves Quick Start on authored defaults without setup or library resolution', async () => {
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    fireEvent.click(await screen.findByText('Entry World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Quick Start' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledWith(['default'], null, true, null, null, null, NO_PERSONA, {}));
    expect(screen.queryByRole('dialog', { name: 'Enter Entry World' })).not.toBeInTheDocument();
  });

  it('remembers explicitly saved additions after cancel and remount', async () => {
    renderMainMenu();
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Library book from Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remember Additions' }));
    expect(screen.getByRole('button', { name: 'Remembered' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    cleanup();
    renderMainMenu();
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).toBeChecked();
    expect(within(screen.getByRole('list', { name: 'Dictionary Order' })).getAllByRole('listitem')[0]).toHaveTextContent('Library book');
  });

  it('keeps session Rolls and live trait, location, and starting-stat Pins until cancellation', async () => {
    const token = encodePlaceholderToken({ id: 'town', mode: 'world', placementId: 'town-use' });
    const mood = encodePlaceholderToken({ id: 'mood', mode: 'world', placementId: 'mood-use' });
    const w = world(true);
    w.data.placeholders = [
      { id: 'town', name: 'Town', values: ['Sedge', 'Marrow'] },
      { id: 'mood', name: 'Mood', values: ['Calm'] },
    ];
    w.data.worldOverview = { ...w.data.worldOverview as object, introReadme: `Introduction town: ${token}` };
    w.data.traits = [
      { id: 'default', name: 'Default trait', isDefault: true, statChanges: [], placeholderPins: [{ placeholderId: 'town', value: 'Trait town' }] },
      { id: 'extra', name: 'Extra trait', groupId: 'group', statChanges: [{ statId: 'favor', type: 'starting', value: 20 }] },
    ];
    w.data.traitGroups = [{ id: 'group', name: 'Other traits', playerDescription: `Town: ${token}. Mood: ${mood}.` }];
    w.data.stats = [{ id: 'favor', name: 'Favor', type: 'number', starting: 0, min: 0, max: 100, regen: 0,
      descriptors: [
        { id: 'low', threshold: 0, description: 'Low' },
        { id: 'high', threshold: 100, description: 'High', placeholderPins: [{ placeholderId: 'mood', value: 'Excited' }] },
      ] }];
    w.data.locations = [
      { id: 'harbor', name: 'Harbor', isStarting: true, playerDescription: `Here: ${token}` },
      { id: 'hill', name: 'Hill', isStarting: true, placeholderPins: [{ placeholderId: 'town', value: 'Hill town' }] },
    ];
    await WorldStorageService.storeWorld(w);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    renderMainMenu();
    fireEvent.click(await screen.findByText('Entry World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
    const intro = await screen.findByRole('dialog', { name: 'Introduction' });
    expect(within(intro).getByText('Introduction town: Trait town')).toBeInTheDocument();
    fireEvent.click(within(intro).getByRole('checkbox', { name: "Don't Show This Again" }));
    fireEvent.click(within(intro).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default trait' }));
    fireEvent.click(screen.getByRole('button', { name: /Other traits/ }));
    expect(screen.getByText('Town: Sedge. Mood: Calm.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Extra trait' }));
    expect(screen.getByText('Town: Sedge. Mood: Excited.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read Introduction' }));
    const reopened = await screen.findByRole('dialog', { name: 'Introduction' });
    fireEvent.click(within(reopened).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('checkbox', { name: 'Extra trait' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    expect(screen.getByText('Here: Hill town')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Avatar' });
    vi.mocked(Math.random).mockReturnValue(0.9);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('radio', { name: /Random/ }));
    expect(screen.getByText('Here: Sedge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Other traits/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Extra trait' }));
    expect(screen.getByText('Town: Sedge. Mood: Calm.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await enter();
    expect(screen.queryByRole('dialog', { name: 'Introduction' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default trait' }));
    fireEvent.click(screen.getByRole('button', { name: /Other traits/ }));
    expect(screen.getByText('Town: Marrow. Mood: Calm.')).toBeInTheDocument();
  });

  it('retains dictionary order and explicit none through Avatar', async () => {
    await WorldStorageService.storeWorld(world(true));
    const onStartGame = vi.fn();
    const user = userEvent.setup();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    await user.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    await user.click(screen.getByRole('button', { name: 'Inspect Library book from Library' }));
    await user.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    await user.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    const order = () => within(screen.getByRole('list', { name: 'Dictionary Order' }))
      .getAllByRole('listitem').map((item) => item.textContent);
    expect(order()[0]).toContain('Library book');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Avatar' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(order()[0]).toContain('Library book');
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable World book from World' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Avatar' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Disabled book from World' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await finalize();
    expect(onStartGame).toHaveBeenCalledWith(['default'], expect.any(Object), true, 'hill', [],
      [expect.objectContaining({ name: 'Companion' })], NO_PERSONA, {}, {});
  });
});

describe('the persona at world entry', () => {
  const storePersona = (id: string, name: string, over: Record<string, unknown> = {}) => EntityStorageService.storeEntity({
    id, name,
    data: { id, name, playerDescription: '', aiDescription: '', aiSummary: '', persona: true, ...over },
  });
  const libraryRef = (entityId: string) => ({ source: 'library', entityId });
  // The shared setup does not clear the entity library, so each persona stored here is removed after.
  afterEach(async () => {
    for (const id of ['self', 'other']) await EntityStorageService.deleteEntity(id).catch(() => {});
  });

  it('starts on the global default and hands it to the game, then remembers it for the world', async () => {
    await storePersona('self', 'Self');
    setDefaultPersona('self');
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    expect(screen.getByRole('heading', { name: 'Persona' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Self' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    expect(onStartGame.mock.calls[0][6]).toEqual({
      ref: libraryRef('self'), libraryEntity: expect.objectContaining({ id: 'self', name: 'Self' }),
    });
    expect(readWorldPersona('entry-world')).toEqual(libraryRef('self'));
  });

  it('sets and clears the global default from the Entities tab, on marked entities only', async () => {
    await storePersona('self', 'Self');
    renderMainMenu();
    fireEvent.click(await screen.findByRole('radio', { name: 'Entities' }));
    fireEvent.contextMenu(await screen.findByText('Companion'));
    expect(screen.queryByRole('menuitem', { name: /Default Persona/ })).not.toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.contextMenu(screen.getByText('Self'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Set as Default Persona' }));
    expect(readDefaultPersona()).toBe('self');
    expect(await screen.findByText('Default')).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText('Self'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Clear Default Persona' }));
    expect(readDefaultPersona()).toBeUndefined();
    await waitFor(() => expect(screen.queryByText('Default')).not.toBeInTheDocument());
  });
});




