import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  benchEditorWorld, entityFieldsTab, openEditorTab, renderWorldEditorBench,
} from '@/test/worldEditorBench';
import type { Stat, World } from '@/types';

/**
 * Stat Blueprints through the real editor: the Stats tab's Blueprints group and Link To…, and an entity's Link
 * Stat, group links and Detach with the link's overrides, Resets and stale mark. What lands in the world is read
 * from the live GameData handle.
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

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
});

const WORLD: World = benchEditorWorld({
  stats: [stat('s-warmth', 'Warmth'), stat('bp-trust', 'Trust', { groupId: 'bp', value: 5 })],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' }],
  entities: [
    { id: 'ash', name: 'Ash', playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'] },
  ],
} as Partial<World>);

const openMirror = (name: string) => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getAllByText(name)[0]);
  fireEvent.mouseDown(entityFieldsTab('Stats'));
};
const openAddMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Add to ${name}` }));
const pickBlueprint = (action: 'Link Stat', name: string) => {
  fireEvent.click(screen.getByRole('button', { name: action }));
  fireEvent.click(within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name }));
};
const entityOf = (ctx: () => { entities: World['entities'] }) => ctx().entities.find((e) => e.id === 'ash')!;
/** The Details tab's number fields, in the order the panel draws them. */
const numberField = (name: 'Base Value' | 'Min' | 'Max' | 'Regen') =>
  screen.getAllByRole('spinbutton')[['Base Value', 'Min', 'Max', 'Regen'].indexOf(name)];

beforeEach(() => { localStorage.clear(); });

describe('the Stats tab Blueprints group', () => {
  it('adds one Blueprints group from the + menu, then offers it no more', () => {
    const { ctx } = renderWorldEditorBench(benchEditorWorld({ stats: [stat('s-warmth', 'Warmth')] } as Partial<World>), 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Blueprints Group' }));
    expect(ctx().statGroups).toEqual([expect.objectContaining({ name: 'Blueprints', system: 'blueprints', parentId: null })]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
    expect(screen.queryByRole('button', { name: 'Add Blueprints Group' })).toBeNull();
  });

  it('asks before deleting a linked Blueprint stat, and takes its links with it', () => {
    const linked = { ...WORLD, entities: [{ ...WORLD.entities[0], statLinks: [{ id: 'l1', originalId: 'bp-trust', kind: 'stat' as const, originalName: 'Trust', groupId: null }] }] };
    const { ctx } = renderWorldEditorBench(linked, 'advanced');
    openEditorTab(/Stats/);
    // The Blueprint comes first; Ash's link to it draws under Ash's node below.
    let row: HTMLElement | null = screen.getAllByText('Trust')[0];
    while (row && !within(row).queryByRole('button', { name: 'Delete' })) row = row.parentElement;
    fireEvent.click(within(row!).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('This also deletes its link.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(ctx().stats.map((s) => s.id)).toEqual(['s-warmth']);
    expect(entityOf(ctx).statLinks).toBeUndefined();
  });
});

describe('Link Stat on an entity', () => {
  it('links a Blueprint once, reads it live and shows where it is linked from', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    pickBlueprint('Link Stat', 'Trust');

    expect(entityOf(ctx).statLinks).toEqual([expect.objectContaining({ originalId: 'bp-trust', kind: 'stat', groupId: null })]);
    expect(entityOf(ctx).stats).toBeUndefined();
    expect(screen.getByText(/Linked from/)).toHaveTextContent('Linked from Blueprints › Trust');
    expect(numberField('Base Value')).toHaveValue(5);

    act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 7 })));
    expect(numberField('Base Value')).toHaveValue(7);

    openAddMenu('Ash');
    fireEvent.click(screen.getByRole('button', { name: 'Link Stat' }));
    const trust = within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name: 'Trust' });
    expect(trust).toHaveAttribute('aria-disabled', 'true');
    expect(trust).toHaveAttribute('aria-description', 'Ash already links Trust');
  });

  it('overrides a field with its own Reset, marks it stale when the Blueprint moves, and resets everything', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    pickBlueprint('Link Stat', 'Trust');

    fireEvent.change(numberField('Base Value'), { target: { value: '9' } });
    fireEvent.change(numberField('Regen'), { target: { value: '2' } });
    expect(entityOf(ctx).statLinks![0].overrides).toEqual({
      'bp-trust': { value: { value: 9, blueprint: 5 }, regen: { value: 2, blueprint: 0 } },
    });
    expect(ctx().stats.find((s) => s.id === 'bp-trust')!.value).toBe(5);
    expect(screen.queryByText('Blueprint changed')).toBeNull();

    act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 6 })));
    expect(screen.getAllByText('Blueprint changed')).toHaveLength(1);
    expect(numberField('Base Value')).toHaveValue(9);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Base Value' }));
    expect(numberField('Base Value')).toHaveValue(6);
    expect(Object.keys(entityOf(ctx).statLinks![0].overrides!['bp-trust'])).toEqual(['regen']);

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
    expect(entityOf(ctx).statLinks![0].overrides).toBeUndefined();
    expect(numberField('Regen')).toHaveValue(0);
  });

  it('keeps the name the Blueprint\'s', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    pickBlueprint('Link Stat', 'Trust');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('contenteditable', 'false');
  });
});

/** The tree or list row that holds `text` and an action named `action`. */
const rowWith = (text: string, action: string): HTMLElement => {
  let row: HTMLElement | null = screen.getAllByText(text)[0];
  while (row && !within(row).queryByRole('button', { name: action })) row = row.parentElement;
  return row!;
};

describe('Detach on an entity', () => {
  it('offers no Copy Stat', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    expect(screen.getByRole('button', { name: 'Link Stat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy Stat' })).toBeNull();
  });

  it('turns a link into the entity\'s own stat under the Blueprint\'s id at once, with its current values', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    pickBlueprint('Link Stat', 'Trust');
    fireEvent.change(numberField('Base Value'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));

    fireEvent.click(within(rowWith('Trust', 'Detach')).getByRole('button', { name: 'Detach' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(entityOf(ctx).statLinks).toBeUndefined();
    expect(entityOf(ctx).stats).toEqual([expect.objectContaining({ id: 'bp-trust', name: 'Trust', value: 9, groupId: null })]);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('contenteditable', 'true');

    act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 2, max: 50 })));
    expect(entityOf(ctx).stats![0]).toMatchObject({ value: 9, max: 10 });
  });

  it('explains why the Blueprint can no longer be linked, in Link Stat and in Link To…', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    pickBlueprint('Link Stat', 'Trust');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));
    fireEvent.click(within(rowWith('Trust', 'Detach')).getByRole('button', { name: 'Detach' }));

    openAddMenu('Ash');
    fireEvent.click(screen.getByRole('button', { name: 'Link Stat' }));
    const trust = within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name: 'Trust' });
    expect(trust).toHaveAttribute('aria-disabled', 'true');
    expect(trust).toHaveAttribute('aria-description', 'Ash already owns Trust');
    fireEvent.keyDown(screen.getByRole('group', { name: 'Blueprints' }), { key: 'Escape' });

    openEditorTab(/Stats/);
    // The Blueprint comes first; Ash's detached Trust draws under Ash's node below.
    fireEvent.click(screen.getAllByText('Trust')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Link To…' }));
    expect(within(screen.getByRole('group', { name: 'Link To' })).getByRole('button', { name: 'Ash' }))
      .toHaveAttribute('aria-description', 'Already owns Trust');
  });
});

describe('a group link', () => {
  const GROUPED: World = {
    ...WORLD,
    stats: [...WORLD.stats, stat('bp-fear', 'Fear', { groupId: 'bp-social', value: 3 })],
    statGroups: [...WORLD.statGroups!, { id: 'bp-social', name: 'Social', parentId: 'bp', order: 1 }],
  };

  it('links a Blueprint group from Link To…, and checks an entity that holds it', () => {
    const { ctx } = renderWorldEditorBench(GROUPED, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(screen.getByText('Social'));
    fireEvent.click(screen.getByRole('button', { name: 'Link To…' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Link To' })).getByRole('button', { name: 'Ash' }));
    expect(entityOf(ctx).statLinks).toEqual([expect.objectContaining({ originalId: 'bp-social', kind: 'group', originalName: 'Social' })]);
    const ash = within(screen.getByRole('group', { name: 'Link To' })).getByRole('button', { name: 'Ash' });
    expect(ash).toHaveAttribute('aria-disabled', 'true');
    expect(ash).toHaveAttribute('aria-description', 'Already links Social');
  });

  it('draws the group in the entity\'s tree, each stat fixed and overridden on its own', () => {
    const linked = { ...GROUPED, entities: [{ ...GROUPED.entities[0], statLinks: [{ id: 'l1', originalId: 'bp-social', kind: 'group' as const, originalName: 'Social', groupId: null }] }] };
    const { ctx } = renderWorldEditorBench(linked, 'advanced');
    openMirror('Ash');
    expect(within(rowWith('Fear', 'Remove')).getByRole('button', { name: 'Remove' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(rowWith('Social', 'Detach')).getByRole('button', { name: 'Remove Link' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fear'));
    expect(screen.getByText(/Part of the linked/)).toHaveTextContent('Part of the linked Blueprints › Social');
    expect(within(rowWith('Social', 'Detach')).queryByLabelText('Modified for this link')).toBeNull();
    fireEvent.change(numberField('Base Value'), { target: { value: '8' } });
    expect(entityOf(ctx).statLinks![0].overrides).toEqual({ 'bp-fear': { value: { value: 8, blueprint: 3 } } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));
    expect(within(rowWith('Social', 'Detach')).getByLabelText('Modified for this link')).toBeInTheDocument();
  });

  it('asks before deleting a linked Blueprint group, and takes its links with it', () => {
    const linked = { ...GROUPED, entities: [{ ...GROUPED.entities[0], statLinks: [{ id: 'l1', originalId: 'bp-social', kind: 'group' as const, originalName: 'Social', groupId: null }] }] };
    const { ctx } = renderWorldEditorBench(linked, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(within(rowWith('Social', 'Delete')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('This also deletes its link.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(ctx().statGroups.map((g) => g.id)).toEqual(['bp']);
    expect(entityOf(ctx).statLinks).toBeUndefined();
  });
});
