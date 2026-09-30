import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, clickFlask, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * The top-level Traits tab on the List Editor: its flat search over world traits, owned traits and Links, and
 * the World Editor holding one selection per tab.
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

const WORLD: World = benchEditorWorld({
  stats: [
    { id: 's-warmth', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] },
    { id: 's-damp', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
  ],
  traitGroups: [
    { id: 'g-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
    { id: 'g-classes', name: 'Classes', parentId: 'g-blueprints', order: 0 },
  ],
  traits: [
    { id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'g-classes' },
    { id: 't-tamer', name: 'Beast Tamer', statChanges: [], groupId: 'g-blueprints', order: 1 },
    // One Bench finding: a pin naming a placeholder that doesn't exist.
    { id: 't-oath', name: 'Hollow Oath', statChanges: [], order: 2, placeholderPins: [{ placeholderId: 'gone', value: 'ash' }] },
  ],
  entities: [
    {
      id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
      traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null }],
      traits: [{ id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [] }],
    },
    {
      id: 'rook', name: 'Rook', playerDescription: 'A ranger.', aiDescription: 'A ranger.', locations: ['harbor'],
      traitLinks: [
        { id: 'l-tamer', originalId: 't-tamer', kind: 'trait', originalName: 'Beast Tamer', groupId: null, order: 0 },
        { id: 'l-classes', originalId: 'g-classes', kind: 'group', originalName: 'Classes', groupId: null, order: 1 },
      ],
    },
  ],
} as Partial<World>);

const searchTraits = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Search or add new traits'), { target: { value: term } });

/** The flat search list's rows, by the label each one shows. */
const searchRows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));

const searchRow = (label: string) => screen.getByRole('button', { name: `Select ${label}` }).parentElement as HTMLElement;

/** A tree row's label. A linked group repeats its original's rows, so the world's own row comes first. */
const clickTreeRow = (name: string) => fireEvent.click(screen.getAllByText(name)[0]);

/** Whether the mobile push shows its detail, empty or not. The pane hides whichever side is off screen. */
const detailPushed = () => document.querySelector('[data-list-detail] > [aria-hidden]')?.getAttribute('aria-hidden') === 'false';

/** The open detail's Name field, which every trait and stat panel leads with. */
const shownName = () => {
  const field = screen.getByLabelText('Name');
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

beforeEach(() => { localStorage.clear(); });

describe('the Traits tab search', () => {
  it('lists world traits bare and owned traits and Links under their owner, as flat rows', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);

    searchTraits('Tame');
    expect(searchRows()).toEqual(['Beast Tamer', 'Ash › Tamed', 'Rook › Beast Tamer']);
  });

  it('leaves groups and entity nodes out, a group Link included only as its own row', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);

    searchTraits('Bond');
    expect(searchRows()).toEqual([]);
    expect(screen.getByText(/No traits match/)).toBeInTheDocument();

    searchTraits('Classes');
    expect(searchRows()).toEqual(['Rook › Classes']);

    // The owner's name finds its traits and Links, never its node.
    searchTraits('Rook');
    expect(searchRows()).toEqual(['Rook › Beast Tamer', 'Rook › Classes']);
  });

  it('opens an owned trait and a Link from their search rows', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);

    searchTraits('Tamed');
    fireEvent.click(screen.getByRole('button', { name: 'Select Ash › Tamed' }));
    expect(shownName()).toBe('Tamed');

    searchTraits('Tamer');
    fireEvent.click(screen.getByRole('button', { name: 'Select Rook › Beast Tamer' }));
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeInTheDocument();
  });

  it('keeps the drag grip on world trait rows only', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);

    searchTraits('Tame');
    expect(within(searchRow('Beast Tamer')).queryByLabelText('Drag to reorder')).not.toBeNull();
    expect(within(searchRow('Ash › Tamed')).queryByLabelText('Drag to reorder')).toBeNull();
    expect(within(searchRow('Rook › Beast Tamer')).queryByLabelText('Drag to reorder')).toBeNull();
  });

  it('removes an owned trait from its search row', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);

    searchTraits('Tamed');
    fireEvent.click(within(searchRow('Ash › Tamed')).getByRole('button', { name: 'Delete' }));
    expect(ctx().entities.find((e) => e.id === 'ash')!.traits ?? []).toEqual([]);
  });
});

describe('one selection per tab', () => {
  it('reopens each tab on its own selection', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);
    clickTreeRow('Paladin');
    expect(shownName()).toBe('Paladin');

    openEditorTab(/Stats/);
    expect(screen.queryByLabelText('Name')).toBeNull();
    fireEvent.click(screen.getByText('Damp'));
    expect(shownName()).toBe('Damp');

    openEditorTab(/Traits/);
    expect(shownName()).toBe('Paladin');
    openEditorTab(/Stats/);
    expect(shownName()).toBe('Damp');
  });

  it('lands a Find hit on its own tab and leaves the other tabs\' selections alone', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);
    clickTreeRow('Paladin');

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    fireEvent.change(await screen.findByLabelText('Find'), { target: { value: 'Damp' } });
    await waitFor(() => expect(screen.getByRole('tab', { name: /Stats/, selected: true })).toBeInTheDocument());
    expect(shownName()).toBe('Damp');
    fireEvent.click(screen.getByRole('button', { name: 'Close find' }));

    openEditorTab(/Traits/);
    expect(shownName()).toBe('Paladin');
  });

  it('opens a Bench finding on its own tab and leaves the other tabs\' selections alone', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(screen.getByText('Damp'));

    await clickFlask();
    // The popover names the finding's trait on its row and its dismiss control; the row is the first.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Hollow Oath' }))[0]);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Traits/, selected: true })).toBeInTheDocument());
    expect(shownName()).toBe('Hollow Oath');

    openEditorTab(/Stats/);
    expect(shownName()).toBe('Damp');
  });

  describe('on mobile', () => {
    let restore: () => void;
    beforeEach(() => { restore = asMobile(); });
    afterEach(() => restore());

    it('shows the next tab\'s list, not a pushed empty detail', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Traits/);
      clickTreeRow('Paladin');
      expect(screen.getByRole('button', { name: 'Back to Traits' })).toBeInTheDocument();

      openEditorTab(/Stats/);
      expect(detailPushed()).toBe(false);

      openEditorTab(/Traits/);
      expect(screen.getByRole('button', { name: 'Back to Traits' })).toBeInTheDocument();
      expect(shownName()).toBe('Paladin');
    });

    it('forgets a selection whose item is gone rather than pushing an empty detail', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Traits/);
      clickTreeRow('Tamed');
      expect(detailPushed()).toBe(true);
      openEditorTab(/Stats/);
      act(() => ctx().editEntity('ash', (e) => ({ ...e, traits: [] })));

      openEditorTab(/Traits/);
      expect(detailPushed()).toBe(false);
    });
  });
});
