import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { panelWorld } from '@/test/panelBench';
import { renderStatsTab } from '@/test/statsTabBench';
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

const WORLD: World = panelWorld({
  stats: [stat('s-warmth', 'Warmth'), stat('bp-trust', 'Trust', { groupId: 'bp', value: 5 })],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' }],
  entities: [
    { id: 'ash', name: 'Ash', playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'] },
  ],
} as Partial<World>);
const entityOf = (ctx: () => { entities: World['entities'] }) => ctx().entities.find((e) => e.id === 'ash')!;
beforeEach(() => { localStorage.clear(); });

/** The tree or list row that holds `text` and an action named `action`. */
const rowWith = (text: string, action: string): HTMLElement => {
  let row: HTMLElement | null = screen.getAllByText(text)[0];
  while (row && !within(row).queryByRole('button', { name: action })) row = row.parentElement;
  return row!;
};

describe('the Stats tab Blueprints group', () => {
  it('adds one Blueprints group from the + menu, then offers it no more', () => {
    const { ctx } = renderStatsTab(panelWorld({ stats: [stat('s-warmth', 'Warmth')] } as Partial<World>), 'advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Blueprints Group' }));
    expect(ctx().statGroups).toEqual([expect.objectContaining({ name: 'Blueprints', system: 'blueprints', parentId: null })]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
    expect(screen.queryByRole('button', { name: 'Add Blueprints Group' })).toBeNull();
  });

  it('asks before deleting a linked Blueprint stat, and takes its links with it', () => {
    const linked = { ...WORLD, entities: [{ ...WORLD.entities[0], statLinks: [{ id: 'l1', originalId: 'bp-trust', kind: 'stat' as const, originalName: 'Trust', groupId: null }] }] };
    const { ctx } = renderStatsTab(linked, 'advanced');
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

describe('a group link', () => {
  const GROUPED: World = {
    ...WORLD,
    stats: [...WORLD.stats, stat('bp-fear', 'Fear', { groupId: 'bp-social', value: 3 })],
    statGroups: [...WORLD.statGroups!, { id: 'bp-social', name: 'Social', parentId: 'bp', order: 1 }],
  };

  it('links a Blueprint group from Link To…, and checks an entity that holds it', () => {
    const { ctx } = renderStatsTab(GROUPED, 'advanced');
    fireEvent.click(screen.getByText('Social'));
    fireEvent.click(screen.getByRole('button', { name: 'Link To…' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Link To' })).getByRole('button', { name: 'Ash' }));
    expect(entityOf(ctx).statLinks).toEqual([expect.objectContaining({ originalId: 'bp-social', kind: 'group', originalName: 'Social' })]);
    const ash = within(screen.getByRole('group', { name: 'Link To' })).getByRole('button', { name: 'Ash' });
    expect(ash).toHaveAttribute('aria-disabled', 'true');
    expect(ash).toHaveAttribute('aria-description', 'Already links Social');
  });
  it('asks before deleting a linked Blueprint group, and takes its links with it', () => {
    const linked = { ...GROUPED, entities: [{ ...GROUPED.entities[0], statLinks: [{ id: 'l1', originalId: 'bp-social', kind: 'group' as const, originalName: 'Social', groupId: null }] }] };
    const { ctx } = renderStatsTab(linked, 'advanced');
    fireEvent.click(within(rowWith('Social', 'Delete')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('This also deletes its link.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(ctx().statGroups.map((g) => g.id)).toEqual(['bp']);
    expect(entityOf(ctx).statLinks).toBeUndefined();
  });
});
