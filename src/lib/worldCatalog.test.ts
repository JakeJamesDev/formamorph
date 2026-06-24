import { beforeEach, describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CatalogWorld } from './worldCatalog';

// The module caches its DB connection in a singleton, so reset modules + the global
// IndexedDB before each test to get a clean, isolated database.
let catalog: typeof import('./worldCatalog');
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  catalog = await import('./worldCatalog');
});

describe('worldCatalog', () => {
  it('returns an empty array when nothing is cached', async () => {
    expect(await catalog.getCatalog()).toEqual([]);
  });

  it('stores and reads back a catalog snapshot', async () => {
    await catalog.replaceCatalog([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ]);
    const out = await catalog.getCatalog();
    expect(out).toHaveLength(2);
    expect(out.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });

  it('replaceCatalog clears the previous snapshot (reconciles removals)', async () => {
    await catalog.replaceCatalog([{ id: 'a' }, { id: 'b' }]);
    await catalog.replaceCatalog([{ id: 'c' }]);
    const out = await catalog.getCatalog();
    expect(out.map((w) => w.id)).toEqual(['c']);
  });

  it('skips entries without a usable id', async () => {
    const worlds: CatalogWorld[] = [
      { id: 'a' },
      { name: 'no id' } as unknown as CatalogWorld,
      { id: '' },
    ];
    await catalog.replaceCatalog(worlds);
    const out = await catalog.getCatalog();
    expect(out.map((w) => w.id)).toEqual(['a']);
  });
});
