import { describe, it, expect } from 'vitest';
import { reorderVisible } from './sortableOrder';

const items = (...ids: string[]) => ids.map((id) => ({ id, name: id.toUpperCase() }));
const ids = (list: { id: string }[]) => list.map((it) => it.id);

/**
 * A sortable list hands its caller the rows it rendered, and the caller writes the whole list back. Where a
 * filter is in play those are two different lists, and folding one into the other is what keeps the rows
 * nobody could see from being deleted by a drag.
 */
describe('reorderVisible', () => {
  it('is the reordered list itself when nothing was filtered out', () => {
    const all = items('a', 'b', 'c');
    expect(ids(reorderVisible(all, [all[2], all[0], all[1]]))).toEqual(['c', 'a', 'b']);
  });

  it('keeps every hidden item, at the index it already held', () => {
    const all = items('a', 'hidden1', 'hidden2', 'b', 'c');
    const visible = [all[0], all[3], all[4]];
    const next = reorderVisible(all, [visible[2], visible[0], visible[1]]);
    expect(ids(next)).toEqual(['c', 'hidden1', 'hidden2', 'a', 'b']);
    // Not merely present — still the same objects, and still between the same neighbours.
    expect(next[1]).toBe(all[1]);
    expect(next[2]).toBe(all[2]);
  });

  it('loses nothing when the visible rows are the tail of the list', () => {
    const all = items('h1', 'h2', 'a', 'b');
    const next = reorderVisible(all, [all[3], all[2]]);
    expect(ids(next)).toEqual(['h1', 'h2', 'b', 'a']);
  });

  it('leaves the list alone when it changed under the drag', () => {
    // A concurrent delete would otherwise deal the wrong item into the freed slot, or none at all.
    const all = items('a', 'hidden', 'b', 'c');
    const stale = [all[0], all[2], all[3], { id: 'gone', name: 'GONE' }];
    expect(reorderVisible(all, stale)).toBe(all);
  });
});
