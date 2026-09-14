import { describe, expect, it } from 'vitest';
import {
  associationRows, heldLibraryItem, installedRows, onlineRows, type InstalledWorld,
} from './componentImport';
import type { LibraryItemSummary } from './librarySources';

const world = (over: Partial<InstalledWorld> = {}): InstalledWorld => ({
  id: 'w-1', name: 'Sedge Landing', sourceId: 'listing-1', ...over,
});

const item = (over: Partial<LibraryItemSummary> = {}): LibraryItemSummary => ({
  kind: 'entity',
  id: 'lib-1',
  name: 'Sedge',
  revision: 'r1',
  owned: true,
  authorLine: 'You',
  sourceLine: 'Your library',
  ...over,
});

describe('associationRows', () => {
  it('matches an association to the installed world holding its listing', () => {
    const rows = associationRows([{ id: 'listing-1', name: 'Sedge Landing' }], [world()]);

    expect(rows).toEqual([{
      listingId: 'listing-1', name: 'Sedge Landing', worldId: 'w-1', worldName: 'Sedge Landing',
    }]);
  });

  it('leaves an association with no installed world unmatched', () => {
    const rows = associationRows([{ id: 'listing-2', name: 'The Long Thaw' }], [world()]);

    expect(rows).toEqual([{ listingId: 'listing-2', name: 'The Long Thaw' }]);
  });

  it('matches on the listing rather than on the name, so two worlds named alike stay apart', () => {
    const rows = associationRows(
      [{ id: 'listing-2', name: 'Sedge Landing' }],
      [world(), world({ id: 'w-2', name: 'Sedge Landing', sourceId: 'listing-2' })],
    );

    expect(rows[0].worldId).toBe('w-2');
  });

  it('ignores a local world with no listing of its own', () => {
    const rows = associationRows([{ id: 'listing-1', name: 'Sedge Landing' }], [
      world({ id: 'w-9', sourceId: undefined }),
    ]);

    expect(rows[0].worldId).toBeUndefined();
  });

  it('names one listing once, however many times the file repeats it', () => {
    const rows = associationRows(
      [{ id: 'listing-1', name: 'Sedge Landing' }, { id: 'listing-1', name: 'Sedge Landing' }],
      [],
    );

    expect(rows).toHaveLength(1);
  });

  it('splits the rows into the ones to link and the ones to download', () => {
    const rows = associationRows(
      [{ id: 'listing-1', name: 'Sedge Landing' }, { id: 'listing-2', name: 'The Long Thaw' }],
      [world()],
    );

    expect(installedRows(rows).map((row) => row.listingId)).toEqual(['listing-1']);
    expect(onlineRows(rows).map((row) => row.listingId)).toEqual(['listing-2']);
  });
});

describe('heldLibraryItem', () => {
  it('finds the item downloaded from the same listing', () => {
    expect(heldLibraryItem({ sourceId: 'listing-1' }, [item({ sourceId: 'listing-1' })])?.id).toBe('lib-1');
  });

  it('prefers the listing over a library id, which means nothing across machines', () => {
    const library = [item({ id: 'their-lib' }), item({ id: 'mine', sourceId: 'listing-1' })];

    expect(heldLibraryItem({ sourceId: 'listing-1', libraryId: 'their-lib' }, library)?.id).toBe('mine');
  });

  it('finds the item a file written on this machine names', () => {
    expect(heldLibraryItem({ libraryId: 'lib-1' }, [item()])?.id).toBe('lib-1');
  });

  it('finds nothing for a component this machine has never held', () => {
    expect(heldLibraryItem({ sourceId: 'listing-9' }, [item()])).toBeUndefined();
    expect(heldLibraryItem(undefined, [item()])).toBeUndefined();
  });
});
