import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench, entityFieldsTab } from '@/test/worldEditorBench';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { World } from '@/types';

/** How the view holds the Placeholders tab: the mobile list after a row is gone, and the entity and book panels' placeholder rows that open another tab. */

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


{
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
  fireEvent.change(screen.getByPlaceholderText('Filter Placeholders'), { target: { value: term } });

const openTab = () => {
  const bench = renderWorldEditorBench(WORLD, 'advanced');
  openEditorTab(/Placeholders/);
  return bench;
};

beforeEach(() => { localStorage.clear(); });


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
}

{
const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `p-${id}` });
const value = (id: string, text: string) => ({ id, text });

const WORLD: World = benchEditorWorld({
  placeholderGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' }],
  placeholders: [
    { id: 'garb', name: 'Class Garb', groupId: 'bp', values: [value('v-tabard', 'a tabard')] },
    { id: 'tone', name: 'Tone', values: [value('v-warm', 'warm')] },
  ],
  traitGroups: [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  traits: [{ id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'tbp', aiDescription: `Wears ${chip('garb')}.` }],
  entities: [
    {
      id: 'molly', name: 'Molly', playerDescription: '', aiDescription: '', locations: [],
      // Molly links Paladin, whose text places the blueprint, so her copy is in use.
      traitLinks: [{ id: 'l-paladin', originalId: 't-paladin', kind: 'trait', originalName: 'Paladin', groupId: null }],
      placeholders: [
        // Eyes owns Iris and references the shared Tone.
        { id: 'eyes', name: 'Eyes', values: [value('v-iris', chip('iris')), value('v-tone', chip('tone'))] },
        { id: 'iris', name: 'Iris', ownerId: 'eyes', values: [value('v-green', 'green')] },
        { id: 'c-garb', name: 'Class Garb', values: [], blueprintId: 'garb' },
      ],
    },
    {
      id: 'tam', name: 'Tam', playerDescription: '', aiDescription: '', locations: [],
      placeholders: [{ id: 'scar', name: 'Scar', values: [value('v-cheek', 'on the cheek')] }],
    },
  ],
  dictionaries: [
    {
      id: 'fen', name: 'Fen Lore', enabled: true, entries: [],
      placeholders: [{ id: 'bog', name: 'Bog Name', values: [value('v-mire', 'the Mire')] }],
    },
    {
      id: 'harbor', name: 'Harbor Lore', enabled: true, entries: [],
      placeholders: [
        { id: 'dock', name: 'Dock', values: [value('v-pier', 'the pier')] },
        // Named after Tam's Scar, whose chip reads under Tam's name.
        { id: 'tale', name: `${chip('scar')} Tale`, values: [value('v-told', 'as told')] },
      ],
    },
  ],
} as Partial<World>);

const bookFieldsTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Dictionary Fields' })).getByRole('tab', { name });

const openEntityPlaceholders = (name: string) => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getAllByText(name)[0]);
  fireEvent.mouseDown(entityFieldsTab('Placeholders'));
};
const openBookPlaceholders = (name: string) => {
  openEditorTab(/Dictionary/);
  fireEvent.click(screen.getAllByText(name)[0]);
  fireEvent.mouseDown(bookFieldsTab('Placeholders'));
};

/** The panel's own region: its tabs root, holding the strip and the tab body. */
const panel = (strip: string) =>
  screen.getByRole('tablist', { name: strip }).parentElement!.closest('[dir][data-orientation]') as HTMLElement;

const searchBox = (strip: string) => within(panel(strip)).getByPlaceholderText('Filter Placeholders');
const search = (strip: string, term: string) => fireEvent.change(searchBox(strip), { target: { value: term } });
/** A tree row in the panel, by the text it shows. */
const treeRow = (strip: string, name: string) => within(panel(strip)).getByText(name);

const backArrow = () => screen.queryByRole('button', { name: 'Back to Placeholders' });
/** Whether an open pane's field holds `text`, apart from a search box that may hold it too. */
const paneShows = (text: string) => screen.queryAllByDisplayValue(text)
  .some((el) => el.getAttribute('placeholder') !== 'Filter Placeholders');

const ENTITY = 'Entity Fields';
const BOOK = 'Dictionary Fields';

beforeEach(() => { localStorage.clear(); });

describe('the entity panel Placeholders tab', () => {
  it("opens a shared row's duplicate, a world placeholder, on the Placeholders tab", () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    const shared = within(panel(ENTITY)).getByRole('button', { name: 'Open Tone' }).closest('.cursor-pointer') as HTMLElement;
    fireEvent.click(within(shared).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().getWorldData().placeholders?.map((p) => p.name)).toEqual(['Class Garb', 'Tone', 'Tone (Copy)']);
    expect(screen.getByRole('tab', { name: /Placeholders/, selected: true })).toBeInTheDocument();
    expect(paneShows('Tone (Copy)')).toBe(true);
    // The panel keeps its own place: back on the entity, its list shows.
    openEditorTab(/Entities/);
    expect(backArrow()).toBeNull();
    expect(treeRow(ENTITY, 'Eyes')).toBeInTheDocument();
  });

  it("opens an owned row's duplicate in the panel", () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    search(ENTITY, 'Iris');
    const row = within(panel(ENTITY)).getByRole('button', { name: 'Select Eyes › Iris' }).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().entities.find((e) => e.id === 'molly')!.placeholders!.map((p) => p.name)).toContain('Iris (Copy)');
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
    expect(backArrow()).toBeInTheDocument();
    expect(paneShows('Iris (Copy)')).toBe(true);
  });

  it('opens a copy in its copy editor, and Edit Blueprint opens the blueprint on the Placeholders tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    fireEvent.click(treeRow(ENTITY, 'Molly.Class Garb'));
    expect(screen.getByText(/Copy of the blueprint/)).toBeInTheDocument();
    expect(screen.getByText('Blueprint Values')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Blueprint' }));
    expect(screen.getByRole('tab', { name: /Placeholders/, selected: true })).toBeInTheDocument();
    expect(screen.queryByText(/Copy of the blueprint/)).toBeNull();
    expect(paneShows('Class Garb')).toBe(true);
    // The panel keeps its own row: back on the entity, the copy is still open.
    openEditorTab(/Entities/);
    expect(screen.getByText(/Copy of the blueprint/)).toBeInTheDocument();
  });
});

describe('the dictionary panel Placeholders tab', () => {
  it('holds its own row apart from the entity panel\'s', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    fireEvent.click(treeRow(ENTITY, 'Eyes'));
    openBookPlaceholders('Fen Lore');
    expect(backArrow()).toBeNull();
    fireEvent.click(treeRow(BOOK, 'Bog Name'));
    openEditorTab(/Entities/);
    expect(paneShows('Eyes')).toBe(true);
    openEditorTab(/Dictionary/);
    expect(paneShows('Bog Name')).toBe(true);
  });
});
}
