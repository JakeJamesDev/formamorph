import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  benchEditorWorld, entityFieldsTab, openEditorTab, renderWorldEditorBench,
} from '@/test/worldEditorBench';
import type { Stat, World } from '@/types';

/**
 * Stat Blueprints through the real editor: the Stats tab's Blueprints group, and an entity's Link Stat and Copy
 * Stat with the link's overrides, Resets and stale mark. What lands in the world is read from the live GameData
 * handle.
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
const pickBlueprint = (action: 'Link Stat' | 'Copy Stat', name: string) => {
  fireEvent.click(screen.getByRole('button', { name: action }));
  fireEvent.click(within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name }));
};
const entityOf = (ctx: () => { entities: World['entities'] }) => ctx().entities.find((e) => e.id === 'ash')!;
/** The Details tab's number fields, in the order the panel draws them. */
const numberField = (name: 'Min' | 'Max' | 'Initial Value' | 'Regen') =>
  screen.getAllByRole('spinbutton')[['Min', 'Max', 'Initial Value', 'Regen'].indexOf(name)];

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
    let row: HTMLElement | null = screen.getByText('Trust');
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
    expect(numberField('Initial Value')).toHaveValue(5);

    act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 7 })));
    expect(numberField('Initial Value')).toHaveValue(7);

    openAddMenu('Ash');
    fireEvent.click(screen.getByRole('button', { name: 'Link Stat' }));
    expect(within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name: 'Trust' })).toBeDisabled();
  });

  it('overrides a field with its own Reset, marks it stale when the Blueprint moves, and resets everything', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    pickBlueprint('Link Stat', 'Trust');

    fireEvent.change(numberField('Initial Value'), { target: { value: '9' } });
    fireEvent.change(numberField('Regen'), { target: { value: '2' } });
    expect(entityOf(ctx).statLinks![0].overrides).toEqual({
      'bp-trust': { value: { value: 9, blueprint: 5 }, regen: { value: 2, blueprint: 0 } },
    });
    expect(ctx().stats.find((s) => s.id === 'bp-trust')!.value).toBe(5);
    expect(screen.queryByText('Blueprint changed')).toBeNull();

    act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 6 })));
    expect(screen.getAllByText('Blueprint changed')).toHaveLength(1);
    expect(numberField('Initial Value')).toHaveValue(9);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Initial Value' }));
    expect(numberField('Initial Value')).toHaveValue(6);
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

describe('Copy Stat on an entity', () => {
  it('adds a detached stat with the Blueprint\'s fields under a fresh id', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    pickBlueprint('Copy Stat', 'Trust');

    const [copy] = entityOf(ctx).stats!;
    expect(copy).toMatchObject({ name: 'Trust', value: 5, groupId: null });
    expect(copy.id).not.toBe('bp-trust');
    expect(entityOf(ctx).statLinks).toBeUndefined();

    act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 7 })));
    expect(entityOf(ctx).stats![0].value).toBe(5);
  });
});
