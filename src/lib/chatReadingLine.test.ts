import { describe, expect, it } from 'vitest';
import { statsSnap, viewedTurn } from './chatReadingLine';

// A 1000px viewport puts the reading line at 300px.
const VIEWPORT = 1000;

describe('viewedTurn', () => {
  it('picks the turn that crosses the reading line', () => {
    const turns = [
      { index: 4, top: -600, bottom: 100 },
      { index: 5, top: 100, bottom: 900 },
      { index: 6, top: 900, bottom: 1500 },
    ];
    expect(viewedTurn(turns, { viewportHeight: VIEWPORT, atBottom: false, latestIndex: 9 })).toBe(5);
  });

  it('picks the turn on the line when two short turns are in view', () => {
    const turns = [
      { index: 2, top: 50, bottom: 250 },
      { index: 3, top: 250, bottom: 450 },
      { index: 4, top: 450, bottom: 650 },
    ];
    expect(viewedTurn(turns, { viewportHeight: VIEWPORT, atBottom: false, latestIndex: 9 })).toBe(3);
  });

  it('counts a turn whose top sits exactly on the line', () => {
    const turns = [
      { index: 2, top: 0, bottom: 300 },
      { index: 3, top: 300, bottom: 600 },
    ];
    expect(viewedTurn(turns, { viewportHeight: VIEWPORT, atBottom: false, latestIndex: 9 })).toBe(3);
  });

  it('picks the nearest turn above when no turn crosses the line', () => {
    const turns = [
      { index: 1, top: -400, bottom: 100 },
      { index: 2, top: 100, bottom: 250 },
      // A gap from 250 to 400 holds the line.
      { index: 3, top: 400, bottom: 700 },
    ];
    expect(viewedTurn(turns, { viewportHeight: VIEWPORT, atBottom: false, latestIndex: 9 })).toBe(2);
  });

  it('picks the latest turn at the bottom, even when an earlier turn crosses the line', () => {
    const turns = [
      { index: 7, top: -200, bottom: 700 },
      { index: 8, top: 700, bottom: 850 },
      { index: 9, top: 850, bottom: 1000 },
    ];
    expect(viewedTurn(turns, { viewportHeight: VIEWPORT, atBottom: true, latestIndex: 9 })).toBe(9);
  });

  it('picks the first mounted turn when every turn is below the line', () => {
    const turns = [{ index: 0, top: 500, bottom: 900 }];
    expect(viewedTurn(turns, { viewportHeight: VIEWPORT, atBottom: false, latestIndex: 3 })).toBe(0);
  });

  it('returns null with no mounted turns', () => {
    expect(viewedTurn([], { viewportHeight: VIEWPORT, atBottom: false, latestIndex: 3 })).toBeNull();
  });
});

describe('statsSnap', () => {
  const at = (page: number, totalPages: number) => ({ page, totalPages });

  it('snaps when Chat moves the viewed turn and no turn is added', () => {
    expect(statsSnap(false, at(5, 9), at(4, 9), true)).toBe(true);
  });

  it('keeps snapping on the renders after a scroll, until a turn is added', () => {
    expect(statsSnap(true, at(9, 9), at(9, 9), true)).toBe(true);
  });

  it('animates again when a submit adds a turn', () => {
    expect(statsSnap(true, at(4, 9), at(10, 10), true)).toBe(false);
  });

  it('animates again when a rollback removes turns', () => {
    expect(statsSnap(true, at(4, 9), at(4, 4), true)).toBe(false);
  });

  it('never snaps in Pages, where the Pager moves the viewed turn', () => {
    expect(statsSnap(false, at(5, 9), at(4, 9), false)).toBe(false);
  });
});
