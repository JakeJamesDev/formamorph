import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench, searchWorldField, shownEditorTab,
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

  it('has no Starting Location filter, and counts the openings an owner has authored', async () => {
    await openOpeningsTab();
    expect(within(pane('editor-list')).queryByRole('combobox', { name: 'Starting Location' })).toBeNull();
    expect(listRows()).toContain('Harbor Steps 2');
    expect(listRows()).toContain('Ferryman 1');
  });

  it('shows a dash for an Others chance with several starts', async () => {
    await openOpeningsTab();
    selectOwner('Harbor Steps');
    expect(paneCards()[0]).toHaveTextContent('—');
    expect(paneCards()[0]).not.toHaveTextContent('%');
  });

  it('shows a percentage for an Others chance with one start', async () => {
    await openOpeningsTab(benchEditorWorld({
      locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, openings: [{ id: 'h1', text: 'Gulls.', kind: 'action' }] }],
    } as unknown as Partial<World>));
    selectOwner('Harbor Steps');
    expect(paneCards()[0]).toHaveTextContent(/\d+%/);
    expect(paneCards()[0]).not.toHaveTextContent('—');
  });

  describe('collapsing groups', () => {
    /** WORLD plus a Cellar under Harbor Steps, so an owner row is a parent as well as the Black Fen and River Folk. */
    const TREE_WORLD: World = {
      ...WORLD,
      locations: [...WORLD.locations, { id: 'cellar', name: 'Cellar', parentId: 'harbor', openings: [{ id: 'c1', text: 'Casks knock.', kind: 'action' }] }],
    } as World;
    const FULL = [
      'This World 1', 'Harbor Steps 2', 'Cellar 1!', '(Black Fen)', 'Old Mill 1!', '—', '(River Folk)', 'Ferryman 1', 'Odd Wick 1', 'Hermit 1!',
    ];
    const ALL_FOLDED = ['This World 1', 'Harbor Steps 2', '(Black Fen)', '—', '(River Folk)', 'Odd Wick 1', 'Hermit 1!'];
    const chevron = (name: string) => within(pane('editor-list')).getByRole('button', { name });
    const collapseAll = () => within(pane('editor-list')).getByRole('button', { name: /^(Collapse|Expand) all groups$/ });

    it('opens with every row expanded', async () => {
      await openOpeningsTab(TREE_WORLD);
      expect(listRows()).toEqual(FULL);
    });

    it("hides and shows a parent's rows with its chevron, for an owner, a location folder and an entity folder", async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.click(chevron('Collapse Harbor Steps'));
      expect(listRows()).not.toContain('Cellar 1!');
      fireEvent.click(chevron('Collapse Black Fen'));
      expect(listRows()).not.toContain('Old Mill 1!');
      fireEvent.click(chevron('Collapse River Folk'));
      expect(listRows()).not.toContain('Ferryman 1');
      expect(listRows()).toEqual(ALL_FOLDED);

      fireEvent.click(chevron('Expand Harbor Steps'));
      fireEvent.click(chevron('Expand Black Fen'));
      fireEvent.click(chevron('Expand River Folk'));
      expect(listRows()).toEqual(FULL);
    });

    it('gives no chevron to This World or a row with nothing under it', async () => {
      await openOpeningsTab(TREE_WORLD);
      for (const name of ['This World', 'Cellar', 'Ferryman', 'Hermit']) {
        expect(within(pane('editor-list')).queryByRole('button', { name: `Collapse ${name}` })).toBeNull();
      }
    });

    it('folds every parent with Collapse All, then opens them all, and its name follows', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.click(collapseAll());
      expect(listRows()).toEqual(ALL_FOLDED);
      expect(collapseAll()).toHaveAccessibleName('Expand all groups');
      fireEvent.click(collapseAll());
      expect(listRows()).toEqual(FULL);
      expect(collapseAll()).toHaveAccessibleName('Collapse all groups');
    });

    it('folds the rest when one parent is already folded', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.click(chevron('Collapse Black Fen'));
      expect(collapseAll()).toHaveAccessibleName('Collapse all groups');
      fireEvent.click(collapseAll());
      expect(listRows()).toEqual(ALL_FOLDED);
    });

    it('shows a match inside a collapsed parent while the search has text', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.click(chevron('Collapse Black Fen'));
      fireEvent.change(tabSearch(), { target: { value: 'creaks' } });
      expect(listRows()).toEqual(['This World 1', '(Black Fen)', 'Old Mill 1!']);
      fireEvent.change(tabSearch(), { target: { value: '' } });
      expect(listRows()).not.toContain('Old Mill 1!');
    });

    it("hides and shows a match with its parent's chevron while the search has text", async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.change(tabSearch(), { target: { value: 'creaks' } });
      fireEvent.click(chevron('Collapse Black Fen'));
      expect(listRows()).toEqual(['This World 1', '(Black Fen)']);
      fireEvent.click(chevron('Expand Black Fen'));
      expect(listRows()).toEqual(['This World 1', '(Black Fen)', 'Old Mill 1!']);
    });

    it('folds the search result with Collapse All, and clearing the search brings back the folds from before it', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.click(chevron('Collapse Harbor Steps'));
      fireEvent.change(tabSearch(), { target: { value: 'creaks' } });
      fireEvent.click(collapseAll());
      expect(listRows()).toEqual(['This World 1', '(Black Fen)']);
      expect(collapseAll()).toHaveAccessibleName('Expand all groups');
      fireEvent.change(tabSearch(), { target: { value: '' } });
      expect(listRows()).toEqual(FULL.filter((row) => row !== 'Cellar 1!'));
    });

    it('opens every match again when the search text changes', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.change(tabSearch(), { target: { value: 'creaks' } });
      fireEvent.click(chevron('Collapse Black Fen'));
      fireEvent.change(tabSearch(), { target: { value: 'creak' } });
      expect(listRows()).toEqual(['This World 1', '(Black Fen)', 'Old Mill 1!']);
    });

    it('keeps the button enabled while the search has text', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.change(tabSearch(), { target: { value: 'creaks' } });
      expect(collapseAll()).toBeEnabled();
    });

    it('keeps its folded groups through a tab switch and back', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.click(collapseAll());
      expect(listRows()).toEqual(ALL_FOLDED);
      openEditorTab(/^Entities$/);
      await waitFor(() => expect(shownEditorTab()).toBe('Entities'));
      openEditorTab(/^Openings$/);
      await waitFor(() => expect(shownEditorTab()).toBe('Openings'));
      expect(listRows()).toEqual(ALL_FOLDED);
      expect(collapseAll()).toHaveAccessibleName('Expand all groups');
    });

    const findCreaks = async () => {
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
      await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
      fireEvent.change(searchWorldField(), { target: { value: 'creaks' } });
    };

    it('opens the groups above an owner that Find jumps to', async () => {
      await openOpeningsTab(TREE_WORLD);
      fireEvent.click(collapseAll());
      expect(listRows()).toEqual(ALL_FOLDED);
      await findCreaks();
      await waitFor(() => expect(listRows()).toContain('Old Mill 1!'));
      expect(listRows()).toContain('(Black Fen)');
    });

    it('opens the groups again for an owner that is already selected', async () => {
      await openOpeningsTab(TREE_WORLD);
      selectOwner('Old Mill');
      fireEvent.click(collapseAll());
      expect(listRows()).toEqual(ALL_FOLDED);
      await findCreaks();
      await waitFor(() => expect(listRows()).toContain('Old Mill 1!'));
    });

    it('keeps the groups closed over a tab switch with the same owner selected', async () => {
      await openOpeningsTab(TREE_WORLD);
      selectOwner('Old Mill');
      fireEvent.click(collapseAll());
      openEditorTab(/^Entities$/);
      await waitFor(() => expect(shownEditorTab()).toBe('Entities'));
      openEditorTab(/^Openings$/);
      await waitFor(() => expect(shownEditorTab()).toBe('Openings'));
      expect(listRows()).toEqual(ALL_FOLDED);
    });

    it('keeps a selected owner selected, with its pane, when its parent collapses', async () => {
      await openOpeningsTab(TREE_WORLD);
      selectOwner('Old Mill');
      fireEvent.click(chevron('Collapse Black Fen'));
      expect(listRows()).not.toContain('Old Mill 1!');
      expect(paneHeading()).toBe('Old Mill');
      expect(paneCards()).toHaveLength(1);
    });
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

  describe('the + picker', () => {
    /** WORLD plus owners to pick: the Cellar under the listed Harbor Steps, the Reed Bed under the pickable
     *  Black Fen, a Boatwright in the River Folk, and a Ghost whose only opening is a hidden Self row. */
    const PICK_WORLD: World = {
      ...WORLD,
      locations: [
        ...WORLD.locations,
        { id: 'cellar', name: 'Cellar', parentId: 'harbor' },
        { id: 'reeds', name: 'Reed Bed', parentId: 'fen' },
      ],
      entities: [
        ...WORLD.entities,
        { id: 'boatwright', name: 'Boatwright', groupId: 'folk' },
        { id: 'ghost', name: 'Ghost', openings: [{ id: 'g1', text: 'A cold hand.', kind: 'action', self: true }] },
      ],
    } as World;

    const openPlus = () => fireEvent.click(within(pane('editor-list')).getByRole('button', { name: 'Add to Openings' }));
    const menuRow = (name: string | RegExp) => screen.getByRole('button', { name });
    const level = (group: 'Locations' | 'Entities') =>
      within(screen.getByRole('group', { name: group })).getAllByRole('button').map((b) => b.textContent);

    it('lists only entities the tab does not list, in their folders', async () => {
      await openOpeningsTab(PICK_WORLD);
      openPlus();
      fireEvent.click(menuRow('Entity'));
      expect(level('Entities')).toEqual(['River Folk', 'Drifter', 'Ghost']);
      fireEvent.click(menuRow('River Folk'));
      expect(level('Entities')).toEqual(['Boatwright']);
    });

    it('lists only locations the tab does not list and their parents; a parent opens its level', async () => {
      await openOpeningsTab(PICK_WORLD);
      openPlus();
      fireEvent.click(menuRow('Location'));
      expect(level('Locations')).toEqual(['Harbor Steps', 'Black Fen', 'Salt Marsh']);

      // Listed itself, so its level has no Add to row.
      fireEvent.click(menuRow('Harbor Steps'));
      expect(level('Locations')).toEqual(['Cellar']);
      fireEvent.click(menuRow('Harbor Steps'));

      // The Old Mill is listed, so only the Reed Bed is offered under the Black Fen.
      fireEvent.click(menuRow('Black Fen'));
      expect(level('Locations')).toEqual(['Add to Black Fen', 'Reed Bed']);
    });

    it("adds one blank opening to a parent from its Add to row, closes the menu and selects it", async () => {
      const bench = await openOpeningsTab(PICK_WORLD);
      openPlus();
      fireEvent.click(menuRow('Location'));
      fireEvent.click(menuRow('Black Fen'));
      fireEvent.click(menuRow('Add to Black Fen'));
      expect(bench.ctx().locations.find((l) => l.id === 'fen')?.openings).toEqual([
        expect.objectContaining({ text: '', kind: 'action' }),
      ]);
      expect(screen.queryByRole('group', { name: 'Locations' })).toBeNull();
      expect(selectedOwner()).toBe('Black Fen');
      expect(paneHeading()).toBe('Black Fen');
      expect(paneCards()).toHaveLength(1);
    });

    it('adds one blank opening to a picked entity and selects it', async () => {
      const bench = await openOpeningsTab(PICK_WORLD);
      openPlus();
      fireEvent.click(menuRow('Entity'));
      fireEvent.click(menuRow('Ghost'));
      const ghost = bench.ctx().entities.find((e) => e.id === 'ghost');
      expect(ghost?.openings).toHaveLength(2);
      expect(ghost?.openings?.[1]).toMatchObject({ text: '', kind: 'action' });
      expect(screen.queryByRole('group', { name: 'Entities' })).toBeNull();
      expect(selectedOwner()).toBe('Ghost');
      expect(listRows()).toContain('Ghost 1!');
    });

    it('ignores the search, and a pick clears the search', async () => {
      await openOpeningsTab(PICK_WORLD);
      // The search hides every owner row.
      fireEvent.change(tabSearch(), { target: { value: 'zzz' } });
      openPlus();
      fireEvent.click(menuRow('Location'));
      expect(level('Locations')).toEqual(['Harbor Steps', 'Black Fen', 'Salt Marsh']);
      fireEvent.click(menuRow('Black Fen'));
      expect(level('Locations')).toEqual(['Add to Black Fen', 'Reed Bed']);
      fireEvent.click(menuRow('Reed Bed'));
      expect(tabSearch()).toHaveValue('');
      // Selected, though the search hides its row (Q16).
      expect(paneHeading()).toBe('Reed Bed');
    });

    it('disables a drill-in with nothing to pick', async () => {
      // Every location and entity already holds an opening.
      await openOpeningsTab(benchEditorWorld({
        locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, openings: [{ id: 'h1', text: 'Gulls.', kind: 'action' }] }],
        entities: [{ id: 'resident', name: 'Odd Wick', locations: ['harbor'], openings: [{ id: 'r1', text: 'A lamp.', kind: 'action' }] }],
      } as unknown as Partial<World>));
      openPlus();
      expect(menuRow('Location')).toBeDisabled();
      expect(menuRow('Entity')).toBeDisabled();
    });

    it("moves focus to each level's Back row, and reaches the pick rows by Tab", async () => {
      const user = userEvent.setup();
      await openOpeningsTab(PICK_WORLD);
      openPlus();
      await user.click(menuRow('Location'));
      expect(menuRow('Location')).toHaveFocus();
      // Back returns focus to the drill row it came from.
      await user.keyboard('{Enter}');
      expect(menuRow('Location')).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.click(menuRow('Black Fen'));
      expect(menuRow('Black Fen')).toHaveFocus();
      await user.tab();
      expect(menuRow('Add to Black Fen')).toHaveFocus();
      await user.tab();
      expect(menuRow('Reed Bed')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(selectedOwner()).toBe('Reed Bed');

      openPlus();
      await user.click(menuRow('Entity'));
      expect(menuRow('Entity')).toHaveFocus();
      await user.click(menuRow('River Folk'));
      expect(menuRow('River Folk')).toHaveFocus();
      await user.tab();
      expect(menuRow('Boatwright')).toHaveFocus();
    });
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
