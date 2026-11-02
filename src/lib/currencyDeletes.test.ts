import { describe, expect, it } from 'vitest';
import {
  backingStatKind, currencyItemKind, currencyUsedBy, goneIds, statIdsOf, withoutBackingStats, withoutCurrencyItem, withoutCurrencyRefs,
} from '@/lib/currencyDeletes';
import { usedByText } from '@/lib/usedByText';
import type { Currency, Entity, Item, Stat } from '@/types';

const stat = (id: string) => ({ id, name: id }) as unknown as Stat;
const item = (id: string, extra: Partial<Item> = {}) => ({ id, name: id, ...extra }) as unknown as Item;
const same = (name: string) => name;

const credits: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'purse' } };
const other: Currency = { id: 'other', name: 'Other', backing: { kind: 'stat', statId: 'bank' } };
const goats: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };
const crowns = (...ids: string[]): Currency => ({
  id: 'crowns', name: 'Crowns', backing: { kind: 'items', items: ids.map((itemId, at) => ({ itemId, worth: 10 ** at })) },
});

describe('stat ids', () => {
  it('lists world stats and each entity’s own', () => {
    const ada = { id: 'ada', name: 'Ada', stats: [stat('purse')] } as Entity;
    expect([...statIdsOf([stat('hunger')], [ada, { id: 'bo', name: 'Bo' }])]).toEqual(['hunger', 'purse']);
  });

  it('names the ids that only the first set holds', () => {
    expect([...goneIds(new Set(['a', 'b']), new Set(['b', 'c']))]).toEqual(['a']);
  });
});

describe('withoutBackingStats', () => {
  it('makes only the Currencies backed by a gone stat name only', () => {
    expect(withoutBackingStats([credits, other, goats], new Set(['purse']))).toEqual([{ ...credits, backing: { kind: 'name' } }, other, goats]);
  });

  it('returns the same list when no gone stat backs one', () => {
    const list = [credits, goats];
    expect(withoutBackingStats(list, new Set(['elsewhere']))).toBe(list);
    expect(withoutBackingStats(list, new Set())).toBe(list);
  });
});

describe('withoutCurrencyItem', () => {
  it('drops the row and keeps the Currency Items-backed while rows remain, base item included', () => {
    expect(withoutCurrencyItem([crowns('copper', 'silver')], 'copper')).toEqual([
      { ...crowns('copper', 'silver'), backing: { kind: 'items', items: [{ itemId: 'silver', worth: 10 }] } },
    ]);
  });

  it('makes the Currency name only when its last row goes', () => {
    expect(withoutCurrencyItem([crowns('copper')], 'copper')).toEqual([{ ...crowns('copper'), backing: { kind: 'name' } }]);
  });

  it('returns the same list when the item is no coin', () => {
    const list = [crowns('copper'), goats];
    expect(withoutCurrencyItem(list, 'lamp')).toBe(list);
  });
});

describe('withoutCurrencyRefs', () => {
  it('clears the Currency on its items and keeps their Value', () => {
    const items = [item('a', { currencyId: 'goats', value: 3 }), item('b', { currencyId: 'credits', value: 4 }), item('c')];
    const next = withoutCurrencyRefs(items, 'goats');
    expect(next[0]).toEqual({ id: 'a', name: 'a', value: 3 });
    expect('currencyId' in next[0]).toBe(false);
    expect(next[1]).toBe(items[1]);
  });

  it('returns the same list when no item uses it', () => {
    const items = [item('a')];
    expect(withoutCurrencyRefs(items, 'goats')).toBe(items);
  });
});

describe('confirm lines', () => {
  it('names the Currencies a deleted stat makes name only', () => {
    expect(usedByText([backingStatKind([credits, other], new Set(['purse', 'bank']), same)])).toBe('This also makes Credits and Other Name Only.');
    expect(usedByText([backingStatKind([credits], new Set(['hunger']), same)])).toBeNull();
  });

  it('says the last item makes the Currency name only, and another item removes its row', () => {
    expect(usedByText([currencyItemKind([crowns('copper')], 'copper', same)])).toBe('This also makes Crowns Name Only.');
    expect(usedByText([currencyItemKind([crowns('copper', 'silver')], 'silver', same)])).toBe('This also removes its item row from Crowns.');
    expect(usedByText([currencyItemKind([crowns('copper')], 'lamp', same)])).toBeNull();
  });

  it('counts the items a deleted Currency clears', () => {
    const items = [item('a', { currencyId: 'goats' }), item('b', { currencyId: 'goats' }), item('c', { currencyId: 'credits' })];
    expect(currencyUsedBy(items, 'goats')).toBe('This also clears the Currency on 2 items.');
    expect(currencyUsedBy(items, 'credits')).toBe('This also clears the Currency on 1 item.');
    expect(currencyUsedBy(items, 'other')).toBeNull();
  });
});
