import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { World } from '@/types';

/**
 * The list toolbar as an author drives it on the World Editor's tabs: the search text names the next add and
 * the box clears after it, the + menus hand the text to their rows, the system-node rows ignore it, and the
 * search matches what the author reads.
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

const HUE = encodePlaceholderToken({ id: 'ph-hue', mode: 'world', placementId: 'hue-1' });

const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e-wick', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    { id: 'e-ash', name: `Ash the ${HUE}`, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'] },
  ],
  placeholders: [{ id: 'ph-hue', name: 'Hue', values: [{ id: 'v1', text: 'Umber' }], roll: true }],
  traits: [{ id: 't-oath', name: 'Oath', statChanges: [], groupId: null, order: 0 }],
  dictionaries: [{ id: 'd-fen', name: 'Fen Lore', enabled: true, entries: [] }],
} as Partial<World>);

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const searchBox = (tab: string) => screen.getByPlaceholderText(`Search or add new ${tab}`) as HTMLInputElement;
const type = (box: HTMLInputElement, value: string) => fireEvent.change(box, { target: { value } });
const addButton = (tab: string) => screen.getByRole('button', { name: `Add to ${tab}` });
const menuButton = (name: string) => screen.getByRole('button', { name });
const flyoutRow = (label: string, name: string) => within(screen.getByRole('group', { name: label })).getByRole('button', { name });

beforeEach(() => { localStorage.clear(); });

describe('the search text names the next add', () => {
  it('names a trait from the + button and clears the box', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openTab(/Traits/);
    const box = searchBox('traits');
    type(box, '  Ember  ');
    fireEvent.click(addButton('Traits'));
    expect(ctx().traits.map((t) => t.name)).toContain('Ember');
    expect(box).toHaveValue('');
  });

  it('hands the trimmed text to a + menu row and clears the box', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    const box = searchBox('traits');
    type(box, ' Rites ');
    fireEvent.click(addButton('Traits'));
    fireEvent.click(menuButton('Add Group'));
    expect(ctx().traitGroups.map((g) => g.name)).toContain('Rites');
    expect(box).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Add Trait' })).toBeNull();
  });

  it('names an owned trait picked through the drill-in', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    const box = searchBox('traits');
    type(box, 'Keen');
    fireEvent.click(addButton('Traits'));
    fireEvent.click(menuButton('Add Trait to Entity'));
    fireEvent.click(flyoutRow('Entities', 'Odd Wick'));
    expect(ctx().entities.find((e) => e.id === 'e-wick')!.traits?.map((t) => t.name)).toEqual(['Keen']);
    expect(box).toHaveValue('');
  });

  it('Add Blueprints Group ignores the text and still clears the box', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    const box = searchBox('traits');
    type(box, 'Not a name');
    fireEvent.click(addButton('Traits'));
    fireEvent.click(menuButton('Add Blueprints Group'));
    expect(ctx().traitGroups.find((g) => g.system === 'blueprints')?.name).toBe('Blueprints');
    expect(box).toHaveValue('');
  });

  it('names an entity from the + button in Basic', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openTab(/Entities/);
    type(searchBox('entities'), 'Mira');
    fireEvent.click(addButton('Entities'));
    expect(ctx().entities.map((e) => e.name)).toContain('Mira');
  });
});

describe('boxes that only name', () => {
  // The Dictionary box searches too (Q23), so the unmatched book leaves the list.
  it('names a new dictionary from the search text', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Dictionary/);
    const box = searchBox('dictionaries');
    type(box, 'Bestiary');
    expect(screen.queryByText('Fen Lore')).toBeNull();
    fireEvent.click(addButton('Dictionary'));
    expect(ctx().dictionaries.map((d) => d.name)).toContain('Bestiary');
    expect(box).toHaveValue('');
  });

  it('names a new placeholder and leaves the list unfiltered', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Placeholders/);
    const box = searchBox('placeholders');
    type(box, 'Eyes');
    expect(screen.getAllByText('Hue').length).toBeGreaterThan(0);
    fireEvent.click(addButton('Placeholders'));
    fireEvent.click(menuButton('Add Placeholder'));
    expect(ctx().placeholders.map((p) => p.name)).toContain('Eyes');
    expect(box).toHaveValue('');
  });
});

describe('search results', () => {
  it('lists the rows whose label matches and says when none do', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Entities/);
    const box = searchBox('entities');
    type(box, 'wick');
    expect(screen.getByText('Odd Wick')).toBeInTheDocument();
    expect(screen.queryByText(/Ash the/)).toBeNull();
    type(box, 'zzz');
    expect(screen.getByText('No entities match “zzz”.')).toBeInTheDocument();
  });

  it('matches the placeholder behind a chip by its name and by its value', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Entities/);
    const box = searchBox('entities');
    type(box, 'hue');
    expect(screen.getByText(/Ash the/)).toBeInTheDocument();
    expect(screen.queryByText('Odd Wick')).toBeNull();
    type(box, 'umber');
    expect(screen.getByText(/Ash the/)).toBeInTheDocument();
  });
});
