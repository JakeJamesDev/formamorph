import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import EntityStorageService from '@/services/EntityStorageService';
import { buildEntityCardData, parseEntityCardData } from '@/lib/entityFile';
import type { LibraryEditorWorld } from '@/lib/libraryGateInput';
import type { Entity, Stat } from '@/types';

/** The library entity editor's Stats tab: the World Editor's tree and panel over the entity's own stats. */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), getEntityMetadata: vi.fn().mockResolvedValue([]), storeEntity: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => { throw new Error('no world'); },
  useGameDataOptional: () => null,
  NoWorld: ({ children }: { children: ReactNode }) => children,
}));

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 3, regen: 0, descriptors: [], ...extra,
});

/** Carried from a world where Trust was a Blueprint under another id. */
const ash: Entity = {
  id: 'ash', name: 'Ash',
  stats: [stat('mood', 'Mood', { groupId: 'g-feel' }), stat('grit', 'Grit')],
  statGroups: [{ id: 'g-feel', name: 'Feelings', parentId: null }],
  statLinks: [
    { id: 'l-trust', originalId: 'w-trust', kind: 'stat', originalName: 'Trust', groupId: null, order: 5 },
    { id: 'l-bond', originalId: 'w-bond', kind: 'stat', originalName: 'Bond', groupId: null, order: 6 },
  ],
};

/** A world whose Blueprints hold its own Trust, and no Bond. */
const world: LibraryEditorWorld = {
  traits: [], traitGroups: [], entities: [], placeholders: [],
  stats: [stat('n-trust', 'Trust', { groupId: 'n-bp', max: 50, value: 5 })],
  statGroups: [{ id: 'n-bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
};

async function openStats(draft: Entity = ash, traitWorld?: LibraryEditorWorld) {
  render(<SettingsProvider><EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} traitWorld={traitWorld} /></SettingsProvider>);
  await userEvent.click(screen.getByRole('tab', { name: 'Stats' }));
}

const numberField = (name: 'Base Value' | 'Min' | 'Max' | 'Regen') =>
  screen.getAllByRole('spinbutton')[['Base Value', 'Min', 'Max', 'Regen'].indexOf(name)];
const searchBox = () => screen.getByPlaceholderText('Search or add new stats');
const openAddMenu = () => userEvent.click(screen.getByRole('button', { name: /^Add to Ash/ }));
const selectedRow = () => within(document.querySelector('[data-editor-row-selected]') as HTMLElement);
const saveEntity = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
  return vi.mocked(EntityStorageService.storeEntity).mock.calls.at(-1)![0].data as Entity;
};

describe('the library entity Stats tab', () => {
  it("shows the entity's own stats and groups, and opens a stat's fields", async () => {
    await openStats();
    expect(screen.getByText('Feelings')).toBeInTheDocument();
    expect(screen.getByText('Grit')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Grit'));
    expect(screen.getByLabelText('Name')).toHaveTextContent('Grit');
    expect(numberField('Base Value')).toBeInTheDocument();
  });

  it('keeps the list beside the details, with no back row', async () => {
    await openStats();
    await userEvent.click(screen.getByText('Grit'));
    expect(numberField('Base Value')).toBeInTheDocument();
    expect(screen.getByText('Feelings')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('saves an edit to an own stat with the entity', async () => {
    await openStats();
    await userEvent.click(screen.getByText('Grit'));
    fireEvent.change(numberField('Base Value'), { target: { value: '7' } });
    const saved = await saveEntity();
    expect(saved.stats!.find((s) => s.id === 'grit')!.value).toBe(7);
    expect(saved.stats!.find((s) => s.id === 'mood')!.value).toBe(3);
  });

  it('keeps its own empty hint on an entity with no stats', async () => {
    await openStats({ id: 'ash', name: 'Ash' });
    expect(screen.getByText('No stats yet. Add one to track something about this entity.')).toBeInTheDocument();
  });
});

describe("the library entity Stats tab's toolbar", () => {
  it('offers the search box and a + menu that adds a stat or a group, and never a Link', async () => {
    // Even inside a world that holds Blueprints, no Link is made here.
    await openStats(ash, world);
    expect(searchBox()).toBeInTheDocument();
    await openAddMenu();
    expect(screen.getByRole('button', { name: 'Add Stat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Group' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Stat' })).not.toBeInTheDocument();
  });

  it('names a new stat from the search text, clears the box, opens it and saves it with the entity', async () => {
    await openStats();
    await userEvent.type(searchBox(), 'Nerve');
    await openAddMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
    expect(searchBox()).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveTextContent('Nerve');
    expect((await saveEntity()).stats!.map((s) => s.name)).toEqual(['Mood', 'Grit', 'Nerve']);
  });

  it('names a new group from the search text and opens it', async () => {
    await openStats();
    await userEvent.type(searchBox(), 'Marks');
    await openAddMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Add Group' }));
    expect(screen.getByLabelText('Group Name')).toHaveTextContent('Marks');
    expect((await saveEntity()).statGroups!.map((g) => g.name)).toEqual(['Feelings', 'Marks']);
  });
});

describe("the library entity Stats tab's search", () => {
  it('lists matching stats flat while a search is typed, and no groups', async () => {
    await openStats();
    await userEvent.type(searchBox(), 'gr');
    expect(screen.getByText('Grit')).toBeInTheDocument();
    expect(screen.queryByText('Mood')).not.toBeInTheDocument();
    expect(screen.queryByText('Feelings')).not.toBeInTheDocument();
    await userEvent.clear(searchBox());
    await userEvent.type(searchBox(), 'zzz');
    expect(screen.getByText('No stats match “zzz”.')).toBeInTheDocument();
  });

  it("removes and duplicates a match through the entity's own stats", async () => {
    await openStats();
    await userEvent.type(searchBox(), 'Grit');
    await userEvent.click(screen.getByText('Grit'));
    await userEvent.click(selectedRow().getByRole('button', { name: 'Duplicate' }));
    expect(selectedRow().getByText('Grit (Copy)')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Grit'));
    await userEvent.click(selectedRow().getByRole('button', { name: 'Delete' }));
    expect((await saveEntity()).stats!.map((s) => s.name)).toEqual(['Mood', 'Grit (Copy)']);
  });
});

describe("the library entity Stats tab's links", () => {
  it('reads each Link by its stored name, dormant, when opened on its own', async () => {
    await openStats();
    expect(screen.getByText('Trust')).toBeInTheDocument();
    expect(screen.getByText('Bond')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Trust'));
    expect(screen.getByText(/Open this entity from a world to edit the link/)).toBeInTheDocument();
    // A dormant Link brings no fields to edit.
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('reads a Link live inside a world, and stores its edit named from that world', async () => {
    await openStats(ash, world);
    await userEvent.click(screen.getByText('Trust'));
    expect(screen.getByText(/^Linked from/)).toHaveTextContent('Linked from Blueprints › Trust');
    expect(numberField('Base Value')).toHaveValue(5);
    fireEvent.change(numberField('Base Value'), { target: { value: '9' } });
    const link = (await saveEntity()).statLinks![0];
    expect(link).toMatchObject({ id: 'l-trust', originalId: 'n-trust', originalName: 'Trust', order: 5 });
    expect(link.overrides!['n-trust'].value).toEqual({ value: 9, blueprint: 5 });
  });

  it('names a Link the world lacks, and removes it there', async () => {
    await openStats(ash, world);
    await userEvent.click(screen.getByText('Bond'));
    expect(screen.getByText(/This world doesn't have it/)).toBeInTheDocument();
    await userEvent.click(selectedRow().getByRole('button', { name: 'Remove Link' }));
    expect((await saveEntity()).statLinks!.map((l) => l.id)).toEqual(['l-trust']);
  });

  it("detaches a Link into the entity's own stat under the Blueprint's id, and keeps the others", async () => {
    await openStats(ash, world);
    await userEvent.click(screen.getByText('Trust'));
    await userEvent.click(selectedRow().getByRole('button', { name: 'Detach' }));
    const saved = await saveEntity();
    expect(saved.stats!.find((s) => s.id === 'n-trust')).toMatchObject({ name: 'Trust', max: 50, value: 5 });
    expect(saved.statLinks!.map((l) => l.id)).toEqual(['l-bond']);
  });

  it('keeps a Link the world lacks as the card stored it', async () => {
    await openStats(ash, world);
    await userEvent.click(screen.getByText('Grit'));
    fireEvent.change(numberField('Base Value'), { target: { value: '8' } });
    expect((await saveEntity()).statLinks!.find((l) => l.id === 'l-bond')).toEqual(ash.statLinks![1]);
  });
});

describe('the library entity Stats tab and the card', () => {
  it('round-trips the stats, groups and Links an author saves here', async () => {
    await openStats(ash, world);
    await userEvent.type(searchBox(), 'Nerve');
    await openAddMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
    const saved = await saveEntity();
    const card = JSON.parse(JSON.stringify(buildEntityCardData(saved, undefined, {}, undefined, { ...world, entities: [saved] })));
    const parsed = parseEntityCardData(card);
    expect(parsed.stats!.map((s) => s.name)).toEqual(['Mood', 'Grit', 'Nerve']);
    expect(parsed.statGroups).toEqual(saved.statGroups);
    expect(parsed.statLinks!.map((l) => [l.id, l.originalName])).toEqual([['l-trust', 'Trust'], ['l-bond', 'Bond']]);
  });
});
