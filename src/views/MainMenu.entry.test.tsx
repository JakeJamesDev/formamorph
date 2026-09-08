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
    data: { id: 'shared', name: 'Library book', enabled: true, entries: [] },
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const click = (name: string) => {
  const heading = screen.getByRole('heading', { name: /^(Choose |Select Starting)/ });
  fireEvent.click(within(heading.parentElement!).getByRole('button', { name }));
};
async function enter() {
  fireEvent.click(await screen.findByText('Entry World'));
  fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
  await screen.findByRole('dialog', { name: 'Enter Entry World' });
}
const dictionaryToggle = (name: string) => within(screen.getByText(name).closest('.border') as HTMLElement).getByRole('checkbox');

describe('the retained entry draft', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    fireEvent.click(screen.getByText('Companion'));
    click('Dictionaries');
    await screen.findByRole('heading', { name: 'Choose Dictionaries' });
    fireEvent.click(dictionaryToggle('World book'));
    fireEvent.click(dictionaryToggle('Library book'));
    click('Back');
    expect(screen.getByRole('checkbox')).toBeChecked();
    click('Back');
    expect(screen.getByRole('radio', { name: 'Hill' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Other traits/ }));
    expect(screen.getByRole('checkbox', { name: 'Extra trait' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    expect(screen.getByRole('radio', { name: 'Hill' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    click('Dictionaries');
    expect(dictionaryToggle('World book')).not.toBeChecked();
    expect(dictionaryToggle('Library book')).toBeChecked();
    click('Start');
    await waitFor(() => expect(onStartGame).toHaveBeenCalledTimes(1));
    expect(onStartGame).toHaveBeenCalledWith(['extra'], null, true, 'hill',
      [expect.objectContaining({ name: 'Library book', id: expect.not.stringMatching(/^shared$/) })],
      [expect.objectContaining({ name: 'Companion', id: expect.not.stringMatching(/^companion$/) })]);
    expect((await EntityStorageService.getEntityData('companion')).id).toBe('companion');
    expect((await DictionaryStorageService.getDictionaryData('shared')).id).toBe('shared');
  });

  it('retains dictionary order and explicit none through Avatar, then resets on cancel and re-entry', async () => {
    await WorldStorageService.storeWorld(world(true));
    const onStartGame = vi.fn();
    const user = userEvent.setup();
    renderMainMenu({ onStartGame });
    await enter();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    fireEvent.click(screen.getByText('Companion'));
    click('Dictionaries');
    fireEvent.click(dictionaryToggle('Library book'));
    // jsdom has no layout; give the real drag sensor distinct row positions.
    ['World book', 'Disabled book', 'Library book'].forEach((name, index) => {
      const element = screen.getByText(name).closest('.border') as HTMLElement;
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, index * 60, 500, 50));
    });
    const row = screen.getByText('Library book').closest('.border') as HTMLElement;
    within(row).getByRole('button').focus();
    await user.keyboard('[Space][ArrowUp][ArrowUp][Space]');
    const order = () => screen.getAllByRole('checkbox').map(el => el.parentElement?.closest('.border')?.textContent);
    expect(order()[0]).toContain('Library book');
    click('Avatar');
    await screen.findByRole('button', { name: 'Finalize Character' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(order()[0]).toContain('Library book');
    expect(dictionaryToggle('Library book')).toBeChecked();
    fireEvent.click(dictionaryToggle('Library book'));
    fireEvent.click(dictionaryToggle('World book'));
    click('Avatar');
    await screen.findByRole('button', { name: 'Finalize Character' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getAllByRole('checkbox').every(el => el.getAttribute('aria-checked') === 'false')).toBe(true);
    click('Avatar');
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize Character' }));
    expect(onStartGame).toHaveBeenCalledWith(['default'], expect.any(Object), true, 'hill', [],
      [expect.objectContaining({ name: 'Companion' })]);
    // The harness keeps MainMenu mounted after handoff; start another ordinary visit.
    await enter();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default trait' }));
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    fireEvent.click(screen.getByText('Companion'));
    click('Dictionaries');
    fireEvent.click(dictionaryToggle('World book'));
    click('Abort');
    await enter();
    expect(screen.getByRole('checkbox', { name: 'Default trait' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    expect(screen.getByRole('radio', { name: /Random/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    click('Dictionaries');
    expect(dictionaryToggle('World book')).toBeChecked();
    expect(dictionaryToggle('Library book')).not.toBeChecked();
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
    fireEvent.click(screen.getByRole('button', { name: 'Introduction' }));
    const reopened = await screen.findByRole('dialog', { name: 'Introduction' });
    fireEvent.click(within(reopened).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('checkbox', { name: 'Extra trait' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Starting Location' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hill' }));
    expect(screen.getByText('Here: Hill town')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    click('Dictionaries'); click('Avatar');
    await screen.findByRole('button', { name: 'Finalize Character' });
    vi.mocked(Math.random).mockReturnValue(0.9);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    click('Back'); click('Back');
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    click('Dictionaries');
    fireEvent.click(dictionaryToggle('Library book'));
    const book = await DictionaryStorageService.getDictionaryData('shared');
    let finish!: (value: typeof book) => void;
    const load = vi.spyOn(DictionaryStorageService, 'getDictionaryData')
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const start = screen.getByRole('button', { name: 'Start' });
    act(() => { fireEvent.click(start); fireEvent.click(start); });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Loading…' }));
    expect(load).toHaveBeenCalledTimes(1);
    click('Abort');
    await enter();
    await act(async () => finish(book));
    expect(onStartGame).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Enter Entry World' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Characters' }));
    click('Dictionaries'); click('Start');
    await waitFor(() => expect(onStartGame).toHaveBeenCalledTimes(1));
  });
});
