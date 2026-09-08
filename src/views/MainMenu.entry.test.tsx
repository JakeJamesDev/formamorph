import { act, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
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
import { toast } from 'react-toastify';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
// WebGL rendering is outside the entry contract; Avatar's controls and handoff stay real.
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const world = (avatar = false): StoredWorldRecord => ({
  id: 'entry-world', name: 'Entry World',
  data: {
    version: __APP_VERSION__,
    worldOverview: { name: 'Entry World', description: '', author: '', systemPrompt: '', use3DModel: avatar, tags: [] },
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function enter() {
  fireEvent.click(await screen.findByText('Entry World'));
  fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
  await screen.findByRole('dialog', { name: 'Enter Entry World' });
}

describe('the retained entry draft', () => {
  it('remembers explicitly saved additions after cancel and remount, with independent runtime copies', async () => {
    const original = await WorldStorageService.getWorldData('entry-world');
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    expect(toast.success).toHaveBeenCalledWith('Formamorph saved these additions for future games.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    cleanup();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).toBeChecked();
    expect(within(screen.getByRole('list', { name: 'Dictionary Order' })).getAllByRole('listitem')[0]).toHaveTextContent('Library book');
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    expect(onStartGame.mock.calls[0][4]).toEqual([
      expect.objectContaining({ name: 'Library book', id: expect.not.stringMatching(/^shared$/) }),
      expect.objectContaining({ name: 'World book', id: 'shared' }),
    ]);
    expect(onStartGame.mock.calls[0][5]).toEqual([expect.objectContaining({ name: 'Companion', id: expect.not.stringMatching(/^companion$/) })]);
    expect((await DictionaryStorageService.getDictionaryData('shared')).entries[0].id).toBe('library-entry');
    expect(await WorldStorageService.getWorldData('entry-world')).toEqual(original);
  });

  it('keeps saved none across restart and one-game overrides, without persisting traits or location', async () => {
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default trait' }));
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable World book from World' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    expect(onStartGame.mock.calls[0][0]).toEqual([]);
    expect(onStartGame.mock.calls[0][3]).toBe('hill');
    expect(onStartGame.mock.calls[0][4]).toEqual([expect.objectContaining({ name: 'Library book' })]);
    expect(onStartGame.mock.calls[0][5]).toEqual([expect.objectContaining({ name: 'Companion' })]);
    cleanup();
    onStartGame.mockClear();
    renderMainMenu({ onStartGame });
    await enter();
    expect(screen.getByRole('checkbox', { name: 'Default trait' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    expect(screen.getByRole('radio', { name: /Random/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledWith(['default'], null, true, null, [], []));
    cleanup();
    onStartGame.mockClear();
    renderMainMenu({ onStartGame });
    fireEvent.click(await screen.findByText('Entry World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Quick Start' }));
    expect(onStartGame).toHaveBeenCalledWith(['default'], null, true);
  });

  it('keeps defaults independent for two local worlds', async () => {
    const second = { ...world(), id: 'second-world', name: 'Second World' };
    await WorldStorageService.storeWorld(second);
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByText('Second World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable World book from World' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    cleanup();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByText('Second World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledWith(['default'], null, true, null, [], []));
  });

  it('keeps a remembered lone world dictionary editable after the library is removed', async () => {
    const w = world();
    w.data.traits = [];
    w.data.locations = [{ id: 'harbor', name: 'Harbor', isStarting: true }];
    w.data.dictionaries = [{ id: 'shared', name: 'World book', enabled: true, entries: [] }];
    await WorldStorageService.storeWorld(w);
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable World book from World' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    cleanup();
    await EntityStorageService.deleteEntity('companion');
    await DictionaryStorageService.deleteDictionary('shared');
    renderMainMenu({ onStartGame });
    await enter();
    expect(onStartGame).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable World book from World' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame.mock.calls[0][4]).toEqual([expect.objectContaining({ id: 'shared' })]));
  });

  it('reports a failed save without false success, retains the draft, and saves on retry', async () => {
    renderMainMenu();
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    vi.mocked(toast.success).mockClear();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Formamorph could not save these additions. Try again.');
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).toBeChecked();
    write.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Use these additions for future games' }));
    expect(toast.success).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    cleanup();
    renderMainMenu();
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).toBeChecked();
  });

  it.each([false, true])('keeps Introduction first with no pickers (Avatar: %s)', async avatar => {
    const w = world(avatar);
    w.data.traits = [];
    w.data.locations = [{ id: 'harbor', name: 'Harbor', isStarting: true }];
    w.data.dictionaries = [{ id: 'shared', name: 'World book', enabled: true, entries: [] }];
    w.data.worldOverview = { ...w.data.worldOverview as object, introReadme: '# Welcome\nRead before entering.' };
    await WorldStorageService.storeWorld(w);
    await EntityStorageService.deleteEntity('companion');
    await DictionaryStorageService.deleteDictionary('shared');
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    fireEvent.click(await screen.findByText('Entry World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
    const intro = await screen.findByRole('dialog', { name: 'Introduction' });
    expect(within(intro).getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    expect(onStartGame).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Finalize Character' })).not.toBeInTheDocument();
    fireEvent.click(within(intro).getByRole('button', { name: 'Close' }));
    if (avatar) fireEvent.click(await screen.findByRole('button', { name: 'Finalize Character' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledTimes(1));
    expect(onStartGame.mock.calls[0][4]).toEqual([expect.objectContaining({ id: 'shared', name: 'World book' })]);
  });

  it('leaves Quick Start on authored defaults without setup or library resolution', async () => {
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    fireEvent.click(await screen.findByText('Entry World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Quick Start' }));
    expect(onStartGame).toHaveBeenCalledWith(['default'], null, true);
    expect(screen.queryByRole('dialog', { name: 'Enter Entry World' })).not.toBeInTheDocument();
  });

  it('starts from the workspace when no library or Avatar continuation remains', async () => {
    const w = world();
    w.data.dictionaries = [];
    await WorldStorageService.storeWorld(w);
    await EntityStorageService.deleteEntity('companion');
    await DictionaryStorageService.deleteDictionary('shared');
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();

    fireEvent.click(screen.getByRole('button', { name: /Other traits/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Extra trait' }));
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    expect(onStartGame).toHaveBeenCalledWith(
      ['default', 'extra'],
      null,
      true,
      'hill',
      [expect.objectContaining({ name: 'Default', enabled: true })],
      [],
    );
  });

  it('retains workspace and library choices through navigation and starts from those choices', async () => {
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default trait' }));
    fireEvent.click(screen.getByRole('button', { name: /Other traits/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Extra trait' }));
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));

    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    expect(screen.getByRole('radio', { name: 'Hill' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Other traits/ }));
    expect(screen.getByRole('checkbox', { name: 'Extra trait' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).toBeChecked();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Library Additions' }), { target: { value: 'World book' } });
    expect(screen.queryByText('Library book')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledTimes(1));
    expect(onStartGame).toHaveBeenCalledWith(['extra'], null, true, 'hill', [
      expect.objectContaining({
        name: 'Library book',
        id: expect.not.stringMatching(/^shared$/),
        entries: [expect.objectContaining({ id: expect.not.stringMatching(/^library-entry$/) })],
      }),
      expect.objectContaining({ name: 'World book', id: 'shared' }),
    ],
      [expect.objectContaining({ name: 'Companion', id: expect.not.stringMatching(/^companion$/) })]);
    expect((await EntityStorageService.getEntityData('companion')).id).toBe('companion');
    expect(await DictionaryStorageService.getDictionaryData('shared')).toMatchObject({
      id: 'shared', entries: [{ id: 'library-entry' }],
    });
  });

  it('retains dictionary order and explicit none through Avatar, then resets on cancel and re-entry', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    await user.click(screen.getByRole('button', { name: 'Move Library book from Library Up' }));
    const order = () => within(screen.getByRole('list', { name: 'Dictionary Order' }))
      .getAllByRole('listitem').map((item) => item.textContent);
    expect(order()[0]).toContain('Library book');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Character' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(order()[0]).toContain('Library book');
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable World book from World' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Character' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Disabled book from World' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize Character' }));
    expect(onStartGame).toHaveBeenCalledWith(['default'], expect.any(Object), true, 'hill', [],
      [expect.objectContaining({ name: 'Companion' })]);
    // The harness keeps MainMenu mounted after handoff; start another ordinary visit.
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default trait' }));
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable World book from World' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await enter();
    expect(screen.getByRole('checkbox', { name: 'Default trait' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    expect(screen.getByRole('radio', { name: /Random/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Companion' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World book from World' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Library book from Library' })).not.toBeChecked();
    expect(order()[0]).toContain('World book');
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
    await screen.findByRole('button', { name: 'Finalize Character' });
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

  it('replaces and click-again clears traits in an exclusive category', async () => {
    const w = world();
    w.data.traits = [
      { id: 'first', name: 'First path', groupId: 'group', statChanges: [] },
      { id: 'second', name: 'Second path', groupId: 'group', statChanges: [] },
    ];
    w.data.traitGroups = [{ id: 'group', name: 'Paths', parentId: null, exclusive: true }];
    await WorldStorageService.storeWorld(w);
    renderMainMenu();
    await enter();

    const first = screen.getByRole('radio', { name: 'First path' });
    const second = screen.getByRole('radio', { name: 'Second path' });
    fireEvent.click(first);
    expect(first).toBeChecked();
    fireEvent.click(second);
    expect(first).not.toBeChecked();
    expect(second).toBeChecked();
    fireEvent.click(second);
    expect(second).not.toBeChecked();
    expect(screen.getByLabelText('0 of 2 selected')).toHaveTextContent('0/2');
  });

  it('ignores duplicate starts and a library load that completes after cancellation', async () => {
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    const book = await DictionaryStorageService.getDictionaryData('shared');
    let finish!: (value: typeof book) => void;
    const load = vi.spyOn(DictionaryStorageService, 'getDictionaryData')
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const start = screen.getByRole('button', { name: 'Start game' });
    act(() => { fireEvent.click(start); fireEvent.click(start); });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Loading…' }));
    expect(load).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await enter();
    await act(async () => finish(book));
    expect(onStartGame).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Enter Entry World' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledTimes(1));
  });

  it('skips selected library records that disappear before finalization', async () => {
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Companion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Library book from Library' }));
    await EntityStorageService.deleteEntity('companion');
    await DictionaryStorageService.deleteDictionary('shared');

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    expect(onStartGame).toHaveBeenCalledWith(
      ['default'], null, true, null,
      [expect.objectContaining({ id: 'shared', name: 'World book' })],
      [],
    );
  });

  it.each(['entity', 'dictionary'] as const)(
    'keeps the editable draft and permits retry when %s resolution fails',
    async (kind) => {
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    const selectedName = kind === 'entity' ? 'Include Companion' : 'Enable Library book from Library';
    fireEvent.click(screen.getByRole('checkbox', { name: selectedName }));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const resolution = kind === 'entity'
      ? vi.spyOn(EntityStorageService, 'getEntityData').mockRejectedValueOnce(new Error('IndexedDB unavailable'))
      : vi.spyOn(DictionaryStorageService, 'getDictionaryData').mockRejectedValueOnce(new Error('IndexedDB unavailable'));

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Formamorph could not prepare those library additions. Try again.',
    ));
    expect(consoleError).toHaveBeenCalledWith(
      'Could not finalize enter-world library additions',
      expect.objectContaining({ message: 'IndexedDB unavailable' }),
    );
    expect(screen.getByRole('dialog', { name: 'Enter Entry World' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: selectedName })).toBeChecked();
    expect(onStartGame).not.toHaveBeenCalled();

    resolution.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
  });
});
