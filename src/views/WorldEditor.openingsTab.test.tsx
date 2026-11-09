import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab,
} from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * The World Editor's Openings tab, driven through the real editor: the owner list beside the selected
 * owner's openings. Each case reads what the author sees, the list pane's rows and the detail pane's cards.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

/** Two starts. The Fen holds none but contains the Mill, which isn't a start. The ferryman sits in the Folk
 *  folder at the Fen; the hermit stands nowhere; the drifter has no openings at all. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', readme: '', tags: [],
    openings: [{ id: 'w1', text: 'The ferry bell tolls over the reeds.', kind: 'narration' }],
  },
  locations: [
    {
      id: 'harbor', name: 'Harbor Steps', isStarting: true,
      openings: [
        { id: 'h1', text: 'Gulls wheel over the pilings.', kind: 'action' },
        { id: 'h2', text: 'A crate splits on the quay.', kind: 'action' },
      ],
    },
    { id: 'fen', name: 'Black Fen', isStarting: true },
    { id: 'mill', name: 'Old Mill', parentId: 'fen', openings: [{ id: 'm1', text: 'The wheel creaks in the dark.', kind: 'action' }] },
    { id: 'marsh', name: 'Salt Marsh' },
  ],
  entityGroups: [{ id: 'folk', name: 'River Folk', parentId: null }],
  entities: [
    {
      id: 'resident', name: 'Odd Wick', locations: ['harbor'],
      openings: [{ id: 'r1', text: 'Odd Wick trims a lamp.', kind: 'action' }],
    },
    {
      id: 'ferryman', name: 'Ferryman', groupId: 'folk', locations: ['fen'],
      openings: [{ id: 'f1', text: 'A pole knocks against the hull.', kind: 'action' }],
    },
    { id: 'hermit', name: 'Hermit', openings: [{ id: 'x1', text: 'Someone hums in the reeds.', kind: 'action' }] },
    { id: 'drifter', name: 'Drifter' },
  ],
} as unknown as Partial<World>);

const pane = (id: 'editor-list' | 'editor-detail') => {
  const el = document.querySelector<HTMLElement>(`[data-panel-id="${id}"]`);
  if (!el) throw new Error(`No ${id} pane`);
  return el;
};

/** The list as the author reads it: an owner row as "Name count", with "!" for the No Starting Location icon;
 *  a context row in parentheses; the rule as "—". An owner row is the row its Select button sits in. */
const listRows = () => [...pane('editor-list').querySelectorAll<HTMLElement>('button[aria-label^="Select "], [data-testid="openings-context-row"], [role="separator"]')]
  .map((el) => {
    if (el.getAttribute('role') === 'separator') return '—';
    if (el.dataset.testid === 'openings-context-row') return `(${el.textContent})`;
    const row = el.parentElement!;
    const noStart = row.querySelector('[aria-label="No Starting Location"]') ? '!' : '';
    return `${el.textContent} ${row.querySelector('.tabular-nums')?.textContent}${noStart}`;
  });

const selectOwner = (name: string) => fireEvent.click(within(pane('editor-list')).getByRole('button', { name: `Select ${name}` }));
const selectedOwner = () => pane('editor-list').querySelector('[data-editor-row-selected] button[aria-label^="Select "]')?.textContent;
const paneCards = () => within(pane('editor-detail')).queryAllByTestId('opening-row');
const paneHeading = () => within(pane('editor-detail')).getByRole('heading').textContent;
const tabSearch = () => within(pane('editor-list')).getByPlaceholderText('Search openings');

const openOpeningsTab = async (world: World = WORLD) => {
  const bench = renderWorldEditorBench(world, 'advanced');
  await screen.findByLabelText('World Name');
  openEditorTab(/^Openings$/);
  return bench;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('the World Editor Openings tab', () => {
  it('is absent in Simple mode', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    await screen.findByLabelText('World Name');
    const tabs = () => within(screen.getByRole('tablist', { name: 'Editor Sections' })).getAllByRole('tab').map((t) => t.textContent);
    expect(tabs()).not.toContain('Openings');
  });

  it('opens on This World, listed even in a world with no openings, with the default-opening note', async () => {
    await openOpeningsTab(benchEditorWorld({}));
    expect(shownEditorTab()).toBe('Openings');
    expect(listRows()).toEqual(['This World 0']);
    expect(selectedOwner()).toBe('This World');
    expect(within(pane('editor-detail')).getByRole('note', { name: 'Default Opening' })).toBeInTheDocument();
  });

  it('lists owners with openings in their nesting, with dim parents, counts and the No Starting Location icon', async () => {
    await openOpeningsTab();
    expect(listRows()).toEqual([
      'This World 1',
      'Harbor Steps 2',
      '(Black Fen)',
      'Old Mill 1!',
      '—',
      '(River Folk)',
      'Ferryman 1',
      'Odd Wick 1',
      'Hermit 1!',
    ]);
    // A context row is not a selection target.
    expect(within(pane('editor-list')).queryByRole('button', { name: 'Select Black Fen' })).toBeNull();
    expect(within(pane('editor-list')).queryByRole('button', { name: 'Select Drifter' })).toBeNull();
    expect(within(pane('editor-list')).queryByRole('button', { name: 'Select Salt Marsh' })).toBeNull();
  });

  it("shows the selected owner's openings, with its No Starting Location note", async () => {
    await openOpeningsTab();
    selectOwner('Old Mill');
    expect(paneHeading()).toBe('Old Mill');
    expect(paneCards()).toHaveLength(1);
    expect(pane('editor-detail')).toHaveTextContent("Isn't a starting location, so its openings never come up");
  });

  it('adds a blank opening to the selected owner, This World included', async () => {
    const bench = await openOpeningsTab();
    const add = () => fireEvent.click(within(pane('editor-detail')).getByRole('button', { name: 'Add Opening' }));
    add();
    expect(bench.ctx().worldOverview.openings).toHaveLength(2);
    expect(bench.ctx().worldOverview.openings?.[1]).toMatchObject({ text: '', kind: 'action' });

    selectOwner('Harbor Steps');
    add();
    expect(bench.ctx().locations.find((l) => l.id === 'harbor')?.openings).toHaveLength(3);
    expect(paneCards()).toHaveLength(3);
    expect(listRows()).toContain('Harbor Steps 3');
  });

  it("keeps an owner listed after its last opening is deleted, until another row is selected", async () => {
    await openOpeningsTab();
    selectOwner('Hermit');
    fireEvent.click(within(pane('editor-detail')).getByRole('button', { name: 'Remove Opening 1' }));
    expect(paneCards()).toHaveLength(0);
    expect(listRows()).toContain('Hermit 0');
    expect(selectedOwner()).toBe('Hermit');

    selectOwner('Odd Wick');
    expect(listRows().some((row) => row.startsWith('Hermit'))).toBe(false);
  });

  it('falls back to This World when the selected owner is deleted', async () => {
    const bench = await openOpeningsTab();
    selectOwner('Hermit');
    act(() => { bench.ctx().removeEntity('hermit'); });
    await waitFor(() => expect(selectedOwner()).toBe('This World'));
    expect(paneHeading()).toBe('This World');
  });

  it('keeps rows whose name or opening text matches the search, and shows only matching openings', async () => {
    await openOpeningsTab();
    selectOwner('Harbor Steps');
    fireEvent.change(tabSearch(), { target: { value: 'crate' } });
    // Matched by an opening's text; This World always stays.
    expect(listRows()).toEqual(['This World 1', 'Harbor Steps 2']);
    expect(paneCards()).toHaveLength(1);
    expect(paneCards()[0]).toHaveTextContent('Opening 2');

    fireEvent.change(tabSearch(), { target: { value: 'ferryman' } });
    // Matched by name, under its folder.
    expect(listRows()).toEqual(['This World 1', '(River Folk)', 'Ferryman 1']);
    // The hidden selection keeps its pane.
    expect(paneHeading()).toBe('Harbor Steps');
    expect(pane('editor-detail')).toHaveTextContent('No openings match');
  });

  it('narrows the rows to what can come up at one start', async () => {
    const user = userEvent.setup();
    await openOpeningsTab();
    await user.click(within(pane('editor-list')).getByRole('combobox', { name: 'Starting Location' }));
    await user.click(screen.getByRole('option', { name: 'Black Fen' }));
    expect(listRows()).toEqual(['This World 1', '(River Folk)', 'Ferryman 1']);
  });

  it('keeps a selection the filter hides, with its pane', async () => {
    const user = userEvent.setup();
    await openOpeningsTab();
    selectOwner('Harbor Steps');
    await user.click(within(pane('editor-list')).getByRole('combobox', { name: 'Starting Location' }));
    await user.click(screen.getByRole('option', { name: 'Black Fen' }));
    expect(listRows()).not.toContain('Harbor Steps 2');
    expect(paneHeading()).toBe('Harbor Steps');
    expect(pane('editor-detail')).toHaveTextContent('None of these openings come up at Black Fen');
  });

  it('keeps the No Starting Location note on a selection the filter hides', async () => {
    const user = userEvent.setup();
    await openOpeningsTab();
    selectOwner('Old Mill');
    await user.click(within(pane('editor-list')).getByRole('combobox', { name: 'Starting Location' }));
    await user.click(screen.getByRole('option', { name: 'Harbor Steps' }));
    expect(listRows().some((row) => row.startsWith('Old Mill'))).toBe(false);
    expect(paneHeading()).toBe('Old Mill');
    expect(pane('editor-detail')).toHaveTextContent("Isn't a starting location, so its openings never come up");
  });

  it("shows an edit made here on the owner's own Openings tab", async () => {
    await openOpeningsTab();
    selectOwner('Odd Wick');
    fireEvent.click(within(pane('editor-detail')).getByRole('button', { name: 'Add Opening' }));
    expect(paneCards()).toHaveLength(2);

    fireEvent.click(within(pane('editor-detail')).getByRole('button', { name: 'Odd Wick' }));
    await waitFor(() => expect(shownEditorTab()).toBe('Entities'));
    const openings = await screen.findByRole('tab', { name: 'Openings', selected: true });
    expect(openings).toBeInTheDocument();
    expect(within(pane('editor-detail')).getAllByTestId('opening-row')).toHaveLength(2);
  });

  it("opens a location's own Openings tab from its name", async () => {
    await openOpeningsTab();
    selectOwner('Harbor Steps');
    fireEvent.click(within(pane('editor-detail')).getByRole('button', { name: 'Harbor Steps' }));
    await waitFor(() => expect(shownEditorTab()).toBe('Locations'));
    expect(await screen.findByRole('tab', { name: 'Openings', selected: true })).toBeInTheDocument();
    expect(within(pane('editor-detail')).getAllByTestId('opening-row')).toHaveLength(2);
  });

  it('opens on the list on mobile, with nothing selected', async () => {
    const restore = asMobile();
    try {
      renderWorldEditorBench(WORLD, 'advanced');
      await screen.findByLabelText('World Name');
      openEditorTab(/^Openings$/);
      expect(await screen.findByRole('button', { name: 'Select This World' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Opening' })).toBeNull();
    } finally {
      restore();
    }
  });

  it("returns from an owner's pane to the list on mobile", async () => {
    const restore = asMobile();
    try {
      renderWorldEditorBench(WORLD, 'advanced');
      await screen.findByLabelText('World Name');
      openEditorTab(/^Openings$/);
      fireEvent.click(await screen.findByRole('button', { name: 'Select Hermit' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Back to Openings' }));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Hermit' })).toBeNull());
      expect(screen.getByRole('button', { name: 'Select Hermit' })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("falls back to This World's pane on mobile when the selected owner is deleted", async () => {
    const restore = asMobile();
    try {
      const bench = renderWorldEditorBench(WORLD, 'advanced');
      await screen.findByLabelText('World Name');
      openEditorTab(/^Openings$/);
      fireEvent.click(await screen.findByRole('button', { name: 'Select Hermit' }));
      expect(await screen.findByRole('heading', { name: 'Hermit' })).toBeInTheDocument();
      act(() => { bench.ctx().removeEntity('hermit'); });
      expect(await screen.findByRole('heading', { name: 'This World' })).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
