import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import type { Currency, Item, World } from '@/types';

/** What deleting a stat, a Currency Item, a Persona or a Currency does to the Currencies that use it (Q22). */

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

const stat = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, type: 'number' as const, description: '', min: 0, max: 99, value: 4, regen: 0, descriptors: [], ...extra });

const priced = (id: string, name: string, currencyId: string): Item => ({ ...blankItem(id, name), value: 7, currencyId });

const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'purse' } };

const dialog = () => screen.getByRole('alertdialog');
const confirm = () => fireEvent.click(within(dialog()).getByRole('button', { name: /^(Delete|Confirm)$/ }));
const treeRow = (name: string) => screen.queryAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement).find((r) => within(r).queryByText(name, { exact: true }))!;
const remove = (name: string) => fireEvent.click(within(treeRow(name)).getByRole('button', { name: 'Delete' }));

beforeEach(() => { localStorage.clear(); });

describe('deleting a backing stat', () => {
  const world = (over: Partial<World> = {}): World => benchEditorWorld({
    stats: [stat('purse', 'Purse'), stat('warmth', 'Warmth')],
    items: [priced('lamp', 'Lamp', 'credits')],
    currencies: [CREDITS],
    ...over,
  } as Partial<World>);

  it('asks first, naming the Currency, and cancel changes nothing', () => {
    const { ctx } = renderWorldEditorBench(world(), 'advanced');
    openEditorTab(/Stats/);
    remove('Purse');
    expect(dialog()).toHaveTextContent('This also makes Credits Name Only.');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(ctx().stats.map((s) => s.id)).toEqual(['purse', 'warmth']);
    expect(ctx().currencies).toEqual([CREDITS]);
  });

  it('makes the Currency name only on confirm, and keeps the item prices', () => {
    const { ctx } = renderWorldEditorBench(world(), 'advanced');
    openEditorTab(/Stats/);
    remove('Purse');
    confirm();
    expect(ctx().stats.map((s) => s.id)).toEqual(['warmth']);
    expect(ctx().currencies).toEqual([{ ...CREDITS, backing: { kind: 'name' } }]);
    expect(ctx().items[0]).toMatchObject({ value: 7, currencyId: 'credits' });
  });

  it('covers a Blueprint stat: its links go and the Currency backed onto it becomes name only', () => {
    const blueprint = { id: 'bp', name: 'Blueprints', system: 'blueprints' as const, parentId: null };
    const link = { id: 'link', originalId: 'purse', kind: 'stat' as const, originalName: 'Purse', groupId: null };
    const { ctx } = renderWorldEditorBench(world({
      stats: [stat('purse', 'Purse', { groupId: 'bp' })],
      statGroups: [blueprint],
      entities: [{ id: 'ada', name: 'Ada', persona: true, statLinks: [link] }],
    } as Partial<World>), 'advanced');
    openEditorTab(/Stats/);
    remove('Purse');
    expect(dialog()).toHaveTextContent('This also deletes its link and makes Credits Name Only.');
    confirm();
    expect(ctx().entities[0].statLinks ?? []).toEqual([]);
    expect(ctx().currencies[0].backing).toEqual({ kind: 'name' });
  });

  it('deletes a stat no Currency uses at once', () => {
    const { ctx } = renderWorldEditorBench(world(), 'advanced');
    openEditorTab(/Stats/);
    remove('Warmth');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().currencies).toEqual([CREDITS]);
  });

  it('asks for a Persona’s own stat, and the Currency it backs becomes name only', () => {
    const { ctx } = renderWorldEditorBench(world({
      stats: [],
      entities: [{ id: 'ada', name: 'Ada', persona: true, stats: [stat('purse', 'Purse')] }],
    } as Partial<World>), 'advanced');
    openEditorTab(/Stats/);
    remove('Purse');
    expect(dialog()).toHaveTextContent('This also makes Credits Name Only.');
    confirm();
    expect(ctx().entities[0].stats ?? []).toEqual([]);
    expect(ctx().currencies[0].backing).toEqual({ kind: 'name' });
  });

  it('keeps the Currency when another Persona still owns a stat with the id', () => {
    const { ctx } = renderWorldEditorBench(world({
      stats: [],
      entities: [
        { id: 'ada', name: 'Ada', persona: true, stats: [stat('purse', 'Purse')] },
        { id: 'bo', name: 'Bo', persona: true, stats: [stat('purse', 'Purse')] },
      ],
    } as Partial<World>), 'advanced');
    act(() => ctx().editEntity('ada', (e) => ({ ...e, stats: [] })));
    expect(ctx().currencies).toEqual([CREDITS]);
  });

  it('cleans up when a Persona that owns the stat is deleted', () => {
    const { ctx } = renderWorldEditorBench(world({
      stats: [],
      entities: [{ id: 'ada', name: 'Ada', persona: true, stats: [stat('purse', 'Purse')] }],
    } as Partial<World>), 'advanced');
    act(() => ctx().removeEntity('ada'));
    expect(ctx().currencies[0].backing).toEqual({ kind: 'name' });
  });

  it('keeps the Currency when Blueprints is removed, because the Persona’s detached copy keeps the id', () => {
    const blueprint = { id: 'bp', name: 'Blueprints', system: 'blueprints' as const, parentId: null };
    const link = { id: 'link', originalId: 'purse', kind: 'stat' as const, originalName: 'Purse', groupId: null };
    const { ctx } = renderWorldEditorBench(world({
      stats: [stat('purse', 'Purse', { groupId: 'bp' })],
      statGroups: [blueprint],
      entities: [{ id: 'ada', name: 'Ada', persona: true, statLinks: [link] }],
    } as Partial<World>), 'advanced');
    act(() => ctx().removeStatGroup('bp'));
    expect(ctx().stats).toEqual([]);
    expect(ctx().entities[0].stats?.map((s) => s.id)).toEqual(['purse']);
    expect(ctx().currencies).toEqual([CREDITS]);
  });
});

describe('deleting an entity from the Entities tab (Q79)', () => {
  const owner = (id: string, name: string, stats: unknown[]) => ({ id, name, persona: true, groupId: null, order: 0, stats });
  const deleteEntity = (name: string) => {
    fireEvent.change(screen.getByPlaceholderText('Filter Entities'), { target: { value: name } });
    const row = screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
  };
  const open = (entities: unknown[]) => {
    const bench = renderWorldEditorBench(benchEditorWorld({ stats: [], currencies: [CREDITS], entities } as Partial<World>), 'advanced');
    openEditorTab(/Entities/);
    return bench;
  };

  it('asks for a plain Persona whose own stat backs a Currency, naming it, and cancel keeps both', () => {
    const { ctx } = open([owner('ada', 'Ada', [stat('purse', 'Purse')])]);
    deleteEntity('Ada');
    expect(dialog()).toHaveTextContent('This also makes Credits Name Only.');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(ctx().entities.map((e) => e.id)).toEqual(['ada']);
    expect(ctx().currencies).toEqual([CREDITS]);
  });

  it('makes the Currency name only on confirm', () => {
    const { ctx } = open([owner('ada', 'Ada', [stat('purse', 'Purse')])]);
    deleteEntity('Ada');
    confirm();
    expect(ctx().entities).toEqual([]);
    expect(ctx().currencies[0].backing).toEqual({ kind: 'name' });
  });

  it('deletes at once when no Currency is affected', () => {
    const { ctx } = open([owner('ada', 'Ada', [stat('warmth', 'Warmth')])]);
    deleteEntity('Ada');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().entities).toEqual([]);
  });
});

describe('deleting a Currency Item', () => {
  const MONEY: Item[] = [blankItem('copper', 'Copper'), blankItem('silver', 'Silver'), priced('pouch', 'Pouch', 'crowns')];
  const crowns = (rows: { itemId: string; worth: number }[]): Currency => ({ id: 'crowns', name: 'Crowns', backing: { kind: 'items', items: rows } });
  const open = (currency: Currency) => {
    const bench = renderWorldEditorBench(benchEditorWorld({ items: MONEY, currencies: [currency] } as Partial<World>), 'advanced');
    openEditorTab(/Items/);
    return bench;
  };
  const deleteItem = (name: string) => fireEvent.click(within(screen.getByRole('button', { name: `Select ${name}` }).parentElement!).getByRole('button', { name: 'Delete' }));

  it('removes its row and names the Currency, and the Currency stays Items-backed', () => {
    const { ctx } = open(crowns([{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 10 }]));
    deleteItem('Silver');
    expect(dialog()).toHaveTextContent('This also removes its item row from Crowns.');
    confirm();
    expect(ctx().currencies[0].backing).toEqual({ kind: 'items', items: [{ itemId: 'copper', worth: 1 }] });
    expect(ctx().items.map((i) => i.id)).toEqual(['copper', 'pouch']);
  });

  it('keeps a Currency Items-backed without its base item, with the other rows', () => {
    const { ctx } = open(crowns([{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 10 }]));
    deleteItem('Copper');
    confirm();
    expect(ctx().currencies[0].backing).toEqual({ kind: 'items', items: [{ itemId: 'silver', worth: 10 }] });
  });

  it('makes the Currency name only when the last item goes, and keeps item prices', () => {
    const { ctx } = open(crowns([{ itemId: 'copper', worth: 1 }]));
    deleteItem('Copper');
    expect(dialog()).toHaveTextContent('This also makes Crowns Name Only.');
    confirm();
    expect(ctx().currencies[0].backing).toEqual({ kind: 'name' });
    expect(ctx().items.find((i) => i.id === 'pouch')).toMatchObject({ value: 7, currencyId: 'crowns' });
  });

  it('deletes an item that is no item at once', () => {
    const { ctx } = open(crowns([{ itemId: 'copper', worth: 1 }]));
    deleteItem('Pouch');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().items.map((i) => i.id)).toEqual(['copper', 'silver']);
  });
});

describe('deleting a Currency', () => {
  const items = [priced('lamp', 'Lamp', 'goats'), priced('rope', 'Rope', 'goats'), priced('bell', 'Bell', 'crowns')];
  const currencies: Currency[] = [
    { id: 'goats', name: 'Goats', backing: { kind: 'name' } },
    { id: 'crowns', name: 'Crowns', backing: { kind: 'name' } },
    { id: 'idle', name: 'Idle', backing: { kind: 'name' } },
  ];
  const open = () => {
    const bench = renderWorldEditorBench(benchEditorWorld({ items, currencies } as Partial<World>), 'advanced');
    openEditorTab(/Items/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Currencies' }));
    return bench;
  };

  it('gives the item count, then clears the Currency on those items and keeps their Value', () => {
    const { ctx } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Goats' }));
    expect(dialog()).toHaveTextContent('This also clears the Currency on 2 items.');
    confirm();
    expect(ctx().currencies.map((c) => c.id)).toEqual(['crowns', 'idle']);
    expect(ctx().items.map((i) => [i.id, i.currencyId, i.value])).toEqual([['lamp', undefined, 7], ['rope', undefined, 7], ['bell', 'crowns', 7]]);
    expect('currencyId' in ctx().items[0]).toBe(false);
  });

  it('keeps everything on cancel', () => {
    const { ctx } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Goats' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(ctx().currencies).toHaveLength(3);
    expect(ctx().items[0].currencyId).toBe('goats');
  });

  it('says one item with the singular noun', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Crowns' }));
    expect(dialog()).toHaveTextContent('This also clears the Currency on 1 item.');
  });

  it('deletes a Currency no item uses at once', () => {
    const { ctx } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Idle' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().currencies.map((c) => c.id)).toEqual(['goats', 'crowns']);
  });
});
