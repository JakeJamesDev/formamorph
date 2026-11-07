import { describe, it, expect } from 'vitest';
import {
  MergeHalt,
  applyMerge,
  planMerge,
  planIsEmpty,
  snapshotsOf,
  type MergeCategory,
  type MergeCategoryInfo,
  type MergeItem,
  type MergeProgress,
} from './engine';
import { appendedSaveOrders, importedSave } from './saveOrder';
import type { SaveMeta } from '@/lib/saveOrdering';
import type { SaveRecord } from '@/types';

describe('importedSave', () => {
  const record = (isAutosave?: boolean) => ({ id: 's', name: 's', ...(isAutosave ? { isAutosave } : {}) }) as unknown as SaveRecord;

  it('lands a new AppData autosave as an ordinary save', () => {
    expect(importedSave(record(true), undefined).isAutosave).toBeUndefined();
  });

  it("keeps the folder copy's autosave flag on a replaced save", () => {
    expect(importedSave(record(false), record(true)).isAutosave).toBe(true);
    expect(importedSave(record(true), record(false)).isAutosave).toBeUndefined();
  });
});

const OLD = '2026-01-01T00:00:00.000Z';
const NEW = '2026-06-01T00:00:00.000Z';

const STAMPED = ['worlds', 'saves', 'entities', 'dictionaries'];
const infos: MergeCategoryInfo[] = STAMPED.map((key) => ({ key, label: key, stamped: true, unit: 'items' }));

const item = (id: string, stamp: string | undefined, size = 10): MergeItem => ({ id, label: id, stamp, size });

/** A category over two in-memory stores; `copy` moves a record from source to target. */
function memoryCategory(key: string, source: MergeItem[], target: MergeItem[], over: Partial<MergeCategory> = {}) {
  const store = new Map(target.map((i) => [i.id, i] as const));
  const writes: string[] = [];
  const category: MergeCategory = {
    key,
    label: key,
    stamped: true,
    unit: 'items',
    source: async () => source,
    target: async () => [...store.values()].map((i) => ({ ...i, size: 0 })),
    copy: async (i) => {
      const record = source.find((s) => s.id === i.id);
      if (!record) throw new Error('gone');
      store.set(i.id, record);
      writes.push(i.id);
    },
    ...over,
  };
  return { category, store, writes };
}

describe('planMerge', () => {
  it.each(STAMPED)('lets the newer AppData copy replace the folder copy in %s', (key) => {
    const [plan] = planMerge(infos.filter((i) => i.key === key), { [key]: [item('a', NEW)] }, { [key]: [item('a', OLD)] });
    expect(plan.replace.map((i) => i.id)).toEqual(['a']);
    expect(plan.keep).toEqual([]);
  });

  it.each(STAMPED)('keeps the newer folder copy in %s', (key) => {
    const [plan] = planMerge(infos.filter((i) => i.key === key), { [key]: [item('a', OLD)] }, { [key]: [item('a', NEW)] });
    expect(plan.replace).toEqual([]);
    expect(plan.keep.map((i) => i.id)).toEqual(['a']);
  });

  it('keeps the folder copy on an equal stamp and on a missing stamp', () => {
    const [plan] = planMerge(
      infos.slice(0, 1),
      { worlds: [item('equal', NEW), item('noSource', undefined), item('noTarget', NEW), item('bad', 'not a date')] },
      { worlds: [item('equal', NEW), item('noSource', OLD), item('noTarget', undefined), item('bad', OLD)] },
    );
    expect(plan.replace).toEqual([]);
    expect(plan.keep.map((i) => i.id).sort()).toEqual(['bad', 'equal', 'noSource', 'noTarget']);
  });

  it('adds items the folder lacks', () => {
    const [plan] = planMerge(infos.slice(0, 1), { worlds: [item('a', OLD), item('b', undefined)] }, { worlds: [] });
    expect(plan.add.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('copies only what the folder lacks in an unstamped category', () => {
    const info: MergeCategoryInfo = { key: 'prefs', label: 'prefs', stamped: false, unit: 'items' };
    const [plan] = planMerge([info], { prefs: [item('held', NEW), item('fresh', NEW)] }, { prefs: [item('held', OLD)] });
    expect(plan.add.map((i) => i.id)).toEqual(['fresh']);
    expect(plan.replace).toEqual([]);
    expect(plan.keep.map((i) => i.id)).toEqual(['held']);
  });

  it('orders items and categories smallest first', () => {
    const plans = planMerge(
      infos,
      {
        worlds: [item('w-big', NEW, 900), item('w-small', NEW, 100)],
        saves: [item('s', NEW, 5000)],
        entities: [item('e-mid', NEW, 50), item('e-tiny', NEW, 1)],
        dictionaries: [item('d', NEW, 10)],
      },
      { worlds: [item('w-big', OLD)] },
    );
    expect(plans.map((p) => p.key)).toEqual(['dictionaries', 'entities', 'worlds', 'saves']);
    expect(plans.find((p) => p.key === 'entities')!.add.map((i) => i.id)).toEqual(['e-tiny', 'e-mid']);
  });

  it('is empty when every AppData item ties', () => {
    const plans = planMerge(infos, { worlds: [item('a', NEW)], saves: [item('s', undefined)] }, { worlds: [item('a', NEW)], saves: [item('s', OLD)] });
    expect(planIsEmpty(plans)).toBe(true);
    expect(planIsEmpty(planMerge(infos, { worlds: [item('b', NEW)] }, {}))).toBe(false);
  });
});

describe('applyMerge', () => {
  it('copies smallest first across new and replaced items, and counts each', async () => {
    const { category, writes } = memoryCategory('worlds', [item('big', NEW, 300), item('small', NEW, 1), item('mid', NEW, 20), item('kept', OLD, 2)], [item('big', OLD), item('kept', NEW)]);
    const plans = planMerge([category], { worlds: await category.source() }, { worlds: await category.target() });
    const [result] = await applyMerge(plans, [category]);
    expect(writes).toEqual(['small', 'mid', 'big']);
    expect(result).toMatchObject({ added: 2, replaced: 1, kept: 1, skipped: [] });
  });

  it('finishes each copy before it reads the next item', async () => {
    const log: string[] = [];
    const category: MergeCategory = {
      key: 'worlds', label: 'worlds', stamped: true, unit: 'items',
      source: async () => [], target: async () => [],
      copy: async (i) => {
        log.push(`read ${i.id}`);
        await new Promise((r) => setTimeout(r, 1));
        log.push(`write ${i.id}`);
      },
    };
    const plans = planMerge([category], { worlds: [item('a', NEW, 1), item('b', NEW, 2)] }, {});
    await applyMerge(plans, [category]);
    expect(log).toEqual(['read a', 'write a', 'read b', 'write b']);
  });

  it('resumes a stopped run with only the rest, and nothing then replaces', async () => {
    const source = [item('a', NEW, 1), item('b', NEW, 2), item('c', NEW, 3), item('d', NEW, 4)];
    const stop = new AbortController();
    const { category, writes } = memoryCategory('worlds', source, [item('a', OLD)]);
    const stopping: MergeCategory = {
      ...category,
      copy: async (i) => {
        await category.copy(i);
        if (writes.length === 2) stop.abort(new Error('force quit'));
      },
    };
    const first = await snapshotsOf([category]);
    const firstPlan = planMerge([category], first.source, first.target);
    expect(firstPlan[0].replace.map((i) => i.id)).toEqual(['a']);
    await expect(applyMerge(firstPlan, [stopping], undefined, stop.signal)).rejects.toThrow('force quit');
    expect(writes).toEqual(['a', 'b']);

    const second = await snapshotsOf([category]);
    const plans = planMerge([category], second.source, second.target);
    expect(plans[0].replace).toEqual([]);
    expect(plans[0].add.map((i) => i.id)).toEqual(['c', 'd']);
    await applyMerge(plans, [category]);
    expect(writes).toEqual(['a', 'b', 'c', 'd']);

    const third = await snapshotsOf([category]);
    expect(planIsEmpty(planMerge([category], third.source, third.target))).toBe(true);
  });

  it('skips a failed item with its reason and goes on', async () => {
    const { category, writes } = memoryCategory('entities', [item('a', NEW, 1), item('b', NEW, 2)], []);
    const failing: MergeCategory = {
      ...category,
      copy: async (i) => {
        if (i.id === 'a') throw new Error('Quota exceeded');
        await category.copy(i);
      },
    };
    const plans = planMerge([category], { entities: await category.source() }, {});
    const [result] = await applyMerge(plans, [failing]);
    expect(writes).toEqual(['b']);
    expect(result.skipped).toEqual([{ label: 'a', reason: 'Quota exceeded' }]);
    expect(result.added).toBe(1);
  });

  it('ends the run on a halt instead of skipping', async () => {
    const { category, writes } = memoryCategory('worlds', [item('a', NEW, 1), item('b', NEW, 2)], []);
    const halting: MergeCategory = {
      ...category,
      copy: async (i) => {
        if (i.id === 'b') throw new MergeHalt('The other copy stopped answering');
        await category.copy(i);
      },
    };
    const plans = planMerge([category], { worlds: await category.source() }, {});
    await expect(applyMerge(plans, [halting])).rejects.toThrow('stopped answering');
    expect(writes).toEqual(['a']);
  });

  it('reports progress per category up to its total, in the category unit', async () => {
    const items = memoryCategory('worlds', [item('a', NEW, 1), item('b', NEW, 2)], []);
    const bytes = memoryCategory('models', [item('m', NEW, 700), item('n', NEW, 300)], [], { unit: 'bytes', stamped: false });
    const plans = planMerge([items.category, bytes.category], {
      worlds: await items.category.source(),
      models: await bytes.category.source(),
    }, {});
    const seen: MergeProgress[] = [];
    await applyMerge(plans, [items.category, bytes.category], (p) => seen.push(p));
    const last = (key: string) => seen.filter((p) => p.key === key).at(-1);
    expect(last('worlds')).toEqual({ key: 'worlds', done: 2, total: 2 });
    expect(last('models')).toEqual({ key: 'models', done: 1000, total: 1000 });
    expect(seen.filter((p) => p.key === 'models').map((p) => p.done)).toEqual([0, 300, 1000]);
  });

  it('passes the added items, not the replaced ones, to finish', async () => {
    let finished: string[] = [];
    const { category } = memoryCategory('saves', [item('old', NEW, 1), item('fresh', NEW, 2)], [item('old', OLD)], {
      finish: async (added) => { finished = added.map((i) => i.id); },
    });
    const plans = planMerge([category], { saves: await category.source() }, { saves: await category.target() });
    await applyMerge(plans, [category]);
    expect(finished).toEqual(['fresh']);
  });
});

describe('appendedSaveOrders', () => {
  const save = (id: string, worldId: string, timestamp: number): SaveMeta => ({ id, name: id, worldId, worldName: worldId, timestamp });
  const worlds = [{ id: 'w1', name: 'w1' }, { id: 'w2', name: 'w2' }];

  it('puts imported saves after the folder\'s stored order', async () => {
    const saves = [save('x', 'w1', 1), save('y', 'w1', 2), save('imported', 'w1', 99)];
    const orders = await appendedSaveOrders(saves, worlds, ['imported'], async (key) => (key === 'w1' ? ['x', 'y'] : []));
    expect(orders).toEqual([{ key: 'w1', ids: ['x', 'y', 'imported'] }]);
  });

  it('puts imported saves after an unordered folder\'s newest-first list', async () => {
    const saves = [save('older', 'w1', 1), save('newer', 'w1', 2), save('imported', 'w1', 99), save('other', 'w2', 5)];
    const orders = await appendedSaveOrders(saves, worlds, ['imported'], async () => []);
    expect(orders).toEqual([{ key: 'w1', ids: ['newer', 'older', 'imported'] }]);
  });

  it('keeps the copy order among imported saves', async () => {
    const saves = [save('mine', 'w2', 1), save('second', 'w2', 50), save('first', 'w2', 10)];
    const orders = await appendedSaveOrders(saves, worlds, ['first', 'second'], async () => []);
    expect(orders).toEqual([{ key: 'w2', ids: ['mine', 'first', 'second'] }]);
  });
});
