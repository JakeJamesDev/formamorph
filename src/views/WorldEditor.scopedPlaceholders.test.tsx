import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, entityFieldsTab, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { World } from '@/types';

/**
 * The entity and dictionary panels' Placeholders tabs on the List Editor: a search box, a + named for the
 * owner, a flat search over the owner's rows, and details stacked over the list. The World Editor holds each
 * panel's open row, and a copy opens its copy editor.
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

const searchBox = (strip: string) => within(panel(strip)).getByPlaceholderText('Search or add new placeholders');
const search = (strip: string, term: string) => fireEvent.change(searchBox(strip), { target: { value: term } });
/** The flat search list's rows, by the label each one shows. */
const searchRows = (strip: string) => within(panel(strip)).queryAllByRole('button', { name: /^Select / })
  .map((b) => b.getAttribute('aria-label')!.slice('Select '.length));
/** A tree row in the panel, by the text it shows. */
const treeRow = (strip: string, name: string) => within(panel(strip)).getByText(name);

const backArrow = () => screen.queryByRole('button', { name: 'Back to Placeholders' });
/** Whether an open pane's field holds `text`, apart from a search box that may hold it too. */
const paneShows = (text: string) => screen.queryAllByDisplayValue(text)
  .some((el) => el.getAttribute('placeholder') !== 'Search or add new placeholders');

const ENTITY = 'Entity Fields';
const BOOK = 'Dictionary Fields';

beforeEach(() => { localStorage.clear(); });

describe('the entity panel Placeholders tab', () => {
  it('adds one placeholder named from the search text, clears the box, and slides its details in', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    search(ENTITY, 'Freckles');
    fireEvent.click(within(panel(ENTITY)).getByRole('button', { name: 'Add Placeholder to Molly' }));
    const molly = ctx().entities.find((e) => e.id === 'molly')!;
    expect(molly.placeholders!.map((p) => p.name)).toEqual(['Eyes', 'Iris', 'Class Garb', 'Freckles']);
    expect(ctx().getWorldData().placeholders?.map((p) => p.name)).toEqual(['Class Garb', 'Tone']);
    expect(searchBox(ENTITY)).toHaveValue('');
    expect(backArrow()).toBeInTheDocument();
    expect(paneShows('Freckles')).toBe(true);
  });

  it('searches the entity\'s own rows flat, by their tree labels, and says when nothing matches', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    // Iris once, at its own row under Eyes; the shared Tone and other owners' rows stay out.
    search(ENTITY, 'Eyes');
    expect(searchRows(ENTITY)).toEqual(['Eyes', 'Eyes › Iris']);
    search(ENTITY, 'Garb');
    expect(searchRows(ENTITY)).toEqual(['Molly.Class Garb']);
    search(ENTITY, 'Tone');
    expect(searchRows(ENTITY)).toEqual([]);
    expect(within(panel(ENTITY)).getByText('No placeholders match “Tone”.')).toBeInTheDocument();
  });

  it('carries the tree row\'s actions onto a search row', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    search(ENTITY, 'Eyes');
    const row = within(panel(ENTITY)).getByRole('button', { name: 'Select Eyes' }).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    // Eyes owns Iris, so the delete asks first and takes Iris with it.
    expect(screen.getByRole('alertdialog', { name: 'Delete Eyes?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(ctx().entities.find((e) => e.id === 'molly')!.placeholders!.map((p) => p.id)).toEqual(['c-garb']);
  });

  it('opens a search row\'s details and returns to the list from the back arrow', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    search(ENTITY, 'Iris');
    fireEvent.click(within(panel(ENTITY)).getByRole('button', { name: 'Select Eyes › Iris' }));
    expect(paneShows('Iris')).toBe(true);
    fireEvent.click(backArrow()!);
    expect(backArrow()).toBeNull();
  });

  it('opens a shared row\'s original from its link, inside the panel', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    fireEvent.click(within(panel(ENTITY)).getByRole('button', { name: 'Open Tone' }));
    expect(backArrow()).toBeInTheDocument();
    expect(paneShows('Tone')).toBe(true);
    expect(entityFieldsTab('Placeholders')).toHaveAttribute('aria-selected', 'true');
  });

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

  it('keeps the open placeholder across a switch to Profile and back', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    fireEvent.click(treeRow(ENTITY, 'Eyes'));
    expect(paneShows('Eyes')).toBe(true);
    fireEvent.mouseDown(entityFieldsTab('Profile'));
    expect(backArrow()).toBeNull();
    fireEvent.mouseDown(entityFieldsTab('Placeholders'));
    expect(backArrow()).toBeInTheDocument();
    expect(paneShows('Eyes')).toBe(true);
  });

  it('returns to the list for another entity, and again when the first comes back', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityPlaceholders('Molly');
    fireEvent.click(treeRow(ENTITY, 'Eyes'));
    expect(backArrow()).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Tam')[0]);
    expect(entityFieldsTab('Placeholders')).toHaveAttribute('aria-selected', 'true');
    expect(backArrow()).toBeNull();
    expect(treeRow(ENTITY, 'Scar')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Molly')[0]);
    expect(backArrow()).toBeNull();
    expect(treeRow(ENTITY, 'Eyes')).toBeInTheDocument();
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
  it('adds one placeholder named from the search text into the book, and slides its details in', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openBookPlaceholders('Fen Lore');
    search(BOOK, 'Reed');
    fireEvent.click(within(panel(BOOK)).getByRole('button', { name: 'Add Placeholder to Fen Lore' }));
    expect(ctx().dictionaries.find((b) => b.id === 'fen')!.placeholders!.map((p) => p.name)).toEqual(['Bog Name', 'Reed']);
    expect(searchBox(BOOK)).toHaveValue('');
    expect(backArrow()).toBeInTheDocument();
    expect(paneShows('Reed')).toBe(true);
  });

  it('searches the book\'s own rows flat and says when nothing matches', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openBookPlaceholders('Fen Lore');
    search(BOOK, 'Bog');
    expect(searchRows(BOOK)).toEqual(['Bog Name']);
    search(BOOK, 'Dock');
    expect(within(panel(BOOK)).getByText('No placeholders match “Dock”.')).toBeInTheDocument();
  });

  it('matches a chip in a name by the owner-qualified label it reads', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openBookPlaceholders('Harbor Lore');
    search(BOOK, 'Tam');
    expect(searchRows(BOOK)).toHaveLength(1);
  });

  it('duplicates a search row into the book and opens the duplicate', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openBookPlaceholders('Fen Lore');
    search(BOOK, 'Bog');
    const row = within(panel(BOOK)).getByRole('button', { name: 'Select Bog Name' }).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().dictionaries.find((b) => b.id === 'fen')!.placeholders!.map((p) => p.name)).toEqual(['Bog Name', 'Bog Name (Copy)']);
    expect(backArrow()).toBeInTheDocument();
    expect(paneShows('Bog Name (Copy)')).toBe(true);
  });

  it('keeps the open placeholder across a switch to Details, and returns to the list for another book', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openBookPlaceholders('Fen Lore');
    fireEvent.click(treeRow(BOOK, 'Bog Name'));
    expect(paneShows('Bog Name')).toBe(true);
    fireEvent.mouseDown(bookFieldsTab('Details'));
    fireEvent.mouseDown(bookFieldsTab('Placeholders'));
    expect(paneShows('Bog Name')).toBe(true);
    fireEvent.click(screen.getAllByText('Harbor Lore')[0]);
    expect(bookFieldsTab('Placeholders')).toHaveAttribute('aria-selected', 'true');
    expect(backArrow()).toBeNull();
    expect(treeRow(BOOK, 'Dock')).toBeInTheDocument();
  });

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
