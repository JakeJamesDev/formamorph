import { describe, it, expect } from 'vitest';
import { compatibleWorldRows, declaresCompatibility, offeredWorldIds, promptCompatibleRows } from './compatibleWorlds';

describe('compatibleWorldRows', () => {
  it('lists every linked world with a listing, unchecked until the author offers it', () => {
    const rows = compatibleWorldRows(
      [{ listingId: 'w1', name: 'Sedge Landing' }, { listingId: 'w2', name: 'The Long Dark' }],
      [],
    );

    expect(rows).toEqual([
      { listingId: 'w1', name: 'Sedge Landing', linked: true, offered: false },
      { listingId: 'w2', name: 'The Long Dark', linked: true, offered: false },
    ]);
  });

  it('checks a world the listing already offers and shows the author answer', () => {
    const rows = compatibleWorldRows(
      [{ listingId: 'w1', name: 'Sedge Landing' }],
      [{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }],
    );

    expect(rows[0]).toEqual({
      listingId: 'w1', name: 'Sedge Landing', linked: true, offered: true, reviewState: 'approved',
    });
  });

  it('shows an association whose local link is gone as a pending removal', () => {
    const rows = compatibleWorldRows([], [{ id: 'w9', name: 'Old World', reviewState: 'unreviewed' }]);

    expect(rows).toEqual([{
      listingId: 'w9', name: 'Old World', linked: false, offered: false, reviewState: 'unreviewed',
    }]);
  });

  it('puts the linked worlds before the pending removals', () => {
    const rows = compatibleWorldRows(
      [{ listingId: 'w1', name: 'Sedge Landing' }],
      [{ id: 'w9', name: 'Old World' }, { id: 'w1', name: 'Sedge Landing' }],
    );

    expect(rows.map((row) => row.listingId)).toEqual(['w1', 'w9']);
  });
});

describe('offeredWorldIds', () => {
  const rows = () => compatibleWorldRows(
    [{ listingId: 'w1', name: 'Sedge Landing' }, { listingId: 'w2', name: 'The Long Dark' }],
    [{ id: 'w1', name: 'Sedge Landing' }, { id: 'w9', name: 'Old World' }],
  );

  it('names the offered linked worlds and drops the pending removal', () => {
    expect(offeredWorldIds(rows())).toEqual(['w1']);
  });

  it('names a world the author has just checked', () => {
    const checked = rows().map((row) => (row.listingId === 'w2' ? { ...row, offered: true } : row));

    expect(offeredWorldIds(checked)).toEqual(['w1', 'w2']);
  });

  it('offers nothing at all for an unlisted component', () => {
    expect(offeredWorldIds(rows(), 'unlisted')).toEqual([]);
  });
});

describe('declaresCompatibility', () => {
  it('says nothing for a component with no eligible world and no association', () => {
    expect(declaresCompatibility([])).toBe(false);
  });

  it('clears an association the author has broken locally', () => {
    expect(declaresCompatibility(compatibleWorldRows([], [{ id: 'w9', name: 'Old World' }]))).toBe(true);
  });
});

describe('promptCompatibleRows', () => {
  const worlds = [
    { listingId: 'w1', name: 'Sedge Landing', pinned: true },
    { listingId: 'w2', name: 'The Long Dark', pinned: false },
  ];

  it('offers every published world, checking the ones pinned to the preset', () => {
    expect(promptCompatibleRows(worlds, null)).toEqual([
      { listingId: 'w1', name: 'Sedge Landing', linked: true, offered: true },
      { listingId: 'w2', name: 'The Long Dark', linked: true, offered: false },
    ]);
  });

  it('on an update, starts from what the listing already offers, not from the pins', () => {
    const rows = promptCompatibleRows(worlds, [{ id: 'w2', name: 'The Long Dark', reviewState: 'approved' }]);
    expect(rows).toEqual([
      { listingId: 'w1', name: 'Sedge Landing', linked: true, offered: false },
      { listingId: 'w2', name: 'The Long Dark', linked: true, offered: true, reviewState: 'approved' },
    ]);
  });

  it('keeps an offer for a world this device has no copy of, still checked', () => {
    const rows = promptCompatibleRows(worlds, [{ id: 'w9', name: 'Elsewhere' }]);
    expect(rows[2]).toEqual({ listingId: 'w9', name: 'Elsewhere', linked: true, offered: true });
    expect(offeredWorldIds(rows)).toEqual(['w9']);
  });
});
