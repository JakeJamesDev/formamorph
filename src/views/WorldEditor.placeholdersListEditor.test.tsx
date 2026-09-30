import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { World } from '@/types';

/**
 * The top-level Placeholders tab on the List Editor: its flat search over each placeholder's own row, world,
 * owned and copies alike, each under the label its tree row shows.
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

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `p-${id}` });
const value = (id: string, text: string) => ({ id, text });

const WORLD: World = benchEditorWorld({
  placeholderGroups: [
    { id: 'bp', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' },
    { id: 'g-looks', name: 'Looks', parentId: null, order: 1 },
  ],
  placeholders: [
    { id: 'garb', name: 'Class Garb', groupId: 'bp', values: [value('v-tabard', 'a tabard')] },
    // Hair owns Color and references the shared Tone, which draws a second row beneath it.
    { id: 'hair', name: 'Hair', groupId: 'g-looks', values: [value('v-color', chip('color')), value('v-tone', chip('tone'))] },
    { id: 'color', name: 'Color', ownerId: 'hair', values: [value('v-red', 'red')] },
    // Tone owns Grain, so Hair's reference to Tone repeats a Grain row beneath it.
    { id: 'tone', name: 'Tone', values: [value('v-grain', chip('grain'))] },
    { id: 'grain', name: 'Grain', ownerId: 'tone', values: [value('v-fine', 'fine')] },
  ],
  traitGroups: [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  traits: [{ id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'tbp', aiDescription: `Wears ${chip('garb')}.` }],
  entities: [{
    id: 'molly', name: 'Molly', playerDescription: '', aiDescription: '', locations: [],
    // Molly links Paladin, whose text places the blueprint, so her copy is in use.
    traitLinks: [{ id: 'l-paladin', originalId: 't-paladin', kind: 'trait', originalName: 'Paladin', groupId: null }],
    placeholders: [
      { id: 'eyes', name: 'Eyes', values: [value('v-iris', chip('iris'))] },
      { id: 'iris', name: 'Iris', ownerId: 'eyes', values: [value('v-green', 'green')] },
      { id: 'c-garb', name: 'Class Garb', values: [], blueprintId: 'garb' },
    ],
  }],
} as Partial<World>);

const searchPlaceholders = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Search or add new placeholders'), { target: { value: term } });

/** The flat search list's rows, by the label each one shows. */
const searchRows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));

const searchRow = (label: string) => screen.getByRole('button', { name: `Select ${label}` }).parentElement as HTMLElement;

/** Whether an open pane's field holds `text`, apart from the search box that may hold it too. */
const paneShows = (text: string) => screen.queryAllByDisplayValue(text)
  .some((el) => el.getAttribute('placeholder') !== 'Search or add new placeholders');

const openTab = () => {
  const bench = renderWorldEditorBench(WORLD, 'advanced');
  openEditorTab(/Placeholders/);
  return bench;
};

beforeEach(() => { localStorage.clear(); });

describe('the Placeholders tab search', () => {
  it('lists world rows by their chain, owned rows under their owner, and a copy as its tree row reads', () => {
    openTab();

    searchPlaceholders('Color');
    expect(searchRows()).toEqual(['Hair › Color']);

    searchPlaceholders('Garb');
    expect(searchRows()).toEqual(['Class Garb', 'Molly.Class Garb']);

    // The owner's name finds its rows, never its node.
    searchPlaceholders('Molly');
    expect(searchRows()).toEqual(['Molly › Eyes', 'Molly › Eyes › Iris', 'Molly.Class Garb']);
  });

  it('lists a shared placeholder once, at its own row, and leaves folders out', () => {
    openTab();

    searchPlaceholders('Tone');
    expect(searchRows()).toEqual(['Tone', 'Tone › Grain']);

    searchPlaceholders('Grain');
    expect(searchRows()).toEqual(['Tone › Grain']);

    searchPlaceholders('Looks');
    expect(searchRows()).toEqual([]);
    expect(screen.getByText(/No placeholders match/)).toBeInTheDocument();

    searchPlaceholders('Blueprints');
    expect(searchRows()).toEqual([]);
  });

  it('opens a nested owned row\'s manager, and keeps it open once the search clears', () => {
    openTab();

    searchPlaceholders('Iris');
    fireEvent.click(screen.getByRole('button', { name: 'Select Molly › Eyes › Iris' }));
    expect(paneShows('Iris')).toBe(true);

    searchPlaceholders('');
    expect(paneShows('Iris')).toBe(true);
  });

  it('opens a copy in its copy editor, as its tree row does', () => {
    openTab();

    searchPlaceholders('Molly.Class');
    fireEvent.click(screen.getByRole('button', { name: 'Select Molly.Class Garb' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Molly.Class Garb');
    expect(screen.getByRole('button', { name: 'Edit Blueprint' })).toBeInTheDocument();
  });

  it('deletes an owned row and what it owns through the confirmation', () => {
    const { ctx } = openTab();

    searchPlaceholders('Eyes');
    fireEvent.click(within(searchRow('Molly › Eyes')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('This also deletes what it owns: Iris.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(ctx().entities[0].placeholders!.map((p) => p.id)).toEqual(['c-garb']);
  });

  it('blocks deleting a copy in use and offers no Duplicate on it', () => {
    const { ctx } = openTab();

    searchPlaceholders('Molly.Class');
    const row = searchRow('Molly.Class Garb');
    expect(within(row).queryByRole('button', { name: 'Duplicate' })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));

    expect(ctx().entities[0].placeholders!.map((p) => p.id)).toContain('c-garb');
  });

  it('duplicates a world row and opens the duplicate', () => {
    const { ctx } = openTab();

    searchPlaceholders('Tone');
    fireEvent.click(within(searchRow('Tone')).getByRole('button', { name: 'Duplicate' }));

    expect(ctx().placeholders.map((p) => p.name)).toContain('Tone (Copy)');
    expect(screen.getByDisplayValue('Tone (Copy)')).toBeInTheDocument();
  });
});

describe('a Placeholders selection whose row is gone, on mobile', () => {
  let restore: () => void;
  beforeEach(() => { restore = asMobile(); });
  afterEach(() => restore());

  /** Whether the mobile push shows its detail, empty or not. */
  const detailPushed = () => document.querySelector('[data-list-detail] > [aria-hidden]')?.getAttribute('aria-hidden') === 'false';

  it('returns to the list rather than pushing an empty detail', () => {
    const { ctx } = openTab();
    searchPlaceholders('Iris');
    fireEvent.click(screen.getByRole('button', { name: 'Select Molly › Eyes › Iris' }));
    expect(detailPushed()).toBe(true);

    openEditorTab(/Stats/);
    act(() => ctx().editEntity('molly', (e) => ({ ...e, placeholders: [] })));
    openEditorTab(/Placeholders/);
    expect(detailPushed()).toBe(false);
  });
});
