import { describe, it, expect } from 'vitest';
import { paginationSlots, maxPaginationSlots, pageWindow, type PageSlot } from './pagination';

const pages = (slots: PageSlot[]) =>
  slots.map((s) => (s.kind === 'page' ? s.page : s.kind === 'ellipsis' ? '…' : '_'));

describe('paginationSlots', () => {
  it('always returns a constant number of slots for a given totalPages (no reflow)', () => {
    for (const total of [1, 3, 6, 7, 10, 100]) {
      const target = maxPaginationSlots(total);
      for (let cur = 1; cur <= total; cur++) {
        expect(paginationSlots(cur, total)).toHaveLength(target);
      }
    }
  });

  it('caps the reserved width at 7 slots for long lists', () => {
    expect(maxPaginationSlots(100)).toBe(7);
    expect(maxPaginationSlots(7)).toBe(7);
    expect(maxPaginationSlots(4)).toBe(4);
    expect(maxPaginationSlots(0)).toBe(0);
  });

  it('shows first, last, and the window around current, with ellipsis gaps', () => {
    // Deep middle of a long list → the full 7-slot window.
    expect(pages(paginationSlots(50, 100))).toEqual([1, '…', 49, 50, 51, '…', 100]);
  });

  it('distributes spacers so low pages hug left, high pages hug right, ellipsis centered', () => {
    // Near the start: 1,2 left · centered … · 100 right-anchored.
    expect(pages(paginationSlots(1, 100))).toEqual([1, 2, '_', '…', '_', '_', 100]);
    // Near the end mirrors it: 1 left · … centered in its gap · 99,100 right-anchored.
    expect(pages(paginationSlots(100, 100))).toEqual([1, '_', '…', '_', '_', 99, 100]);
  });

  it('shows every page (no ellipsis/pad) when they all fit', () => {
    expect(pages(paginationSlots(2, 3))).toEqual([1, 2, 3]);
  });
});

describe('pageWindow', () => {
  it('centers a 3-page window on the current page in the middle', () => {
    expect(pageWindow(5, 10)).toEqual([4, 5, 6]);
  });

  it('clamps to the start and end without ever leaving the range', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3]);
    expect(pageWindow(10, 10)).toEqual([8, 9, 10]);
    expect(pageWindow(9, 10)).toEqual([8, 9, 10]);
  });

  it('shrinks when there are fewer than `size` pages', () => {
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 0)).toEqual([]);
  });
});
