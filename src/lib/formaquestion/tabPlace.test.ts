// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TAB_PLACE, moveByKey, placeAt, readTabPlace, wholeOnScreen, writeTabPlace, type TabPlace,
} from './tabPlace';

const SCREEN = { width: 1600, height: 900 };
/** A tab 100 pixels long on its edge. */
const LENGTH = 100;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('placeAt', () => {
  it('picks the nearest edge and the place along it', () => {
    expect(placeAt(1590, 450, SCREEN)).toEqual({ edge: 'right', at: 0.5 });
    expect(placeAt(10, 225, SCREEN)).toEqual({ edge: 'left', at: 0.25 });
    expect(placeAt(400, 5, SCREEN)).toEqual({ edge: 'top', at: 0.25 });
    expect(placeAt(1200, 895, SCREEN)).toEqual({ edge: 'bottom', at: 0.75 });
  });
});

describe('wholeOnScreen', () => {
  it('keeps the whole tab on the screen with a gap at the corner', () => {
    const top = wholeOnScreen({ edge: 'right', at: 0 }, LENGTH, SCREEN);
    expect(top.at * SCREEN.height - LENGTH / 2).toBeGreaterThan(0);
    const end = wholeOnScreen({ edge: 'bottom', at: 1 }, LENGTH, SCREEN);
    expect(end.at * SCREEN.width + LENGTH / 2).toBeLessThan(SCREEN.width);
  });

  it('leaves a place in the middle of an edge alone', () => {
    expect(wholeOnScreen({ edge: 'left', at: 0.4 }, LENGTH, SCREEN)).toEqual({ edge: 'left', at: 0.4 });
  });

  it('centers a tab that is longer than its edge', () => {
    expect(wholeOnScreen({ edge: 'top', at: 0.1 }, 400, { width: 300, height: 900 }).at).toBe(0.5);
  });
});

describe('moveByKey', () => {
  const right: TabPlace = { edge: 'right', at: 0.5 };

  it('moves along the edge', () => {
    expect(moveByKey(right, 'ArrowUp', LENGTH, SCREEN)).toEqual({ edge: 'right', at: 0.45 });
    expect(moveByKey(right, 'ArrowDown', LENGTH, SCREEN)).toEqual({ edge: 'right', at: 0.55 });
    expect(moveByKey({ edge: 'top', at: 0.5 }, 'ArrowLeft', LENGTH, SCREEN)).toEqual({ edge: 'top', at: 0.45 });
  });

  it('goes to the opposite edge on an arrow away from its edge', () => {
    expect(moveByKey(right, 'ArrowLeft', LENGTH, SCREEN)).toEqual({ edge: 'left', at: 0.5 });
    expect(moveByKey({ edge: 'top', at: 0.3 }, 'ArrowDown', LENGTH, SCREEN)).toEqual({ edge: 'bottom', at: 0.3 });
  });

  it('returns the same place on an arrow into its edge', () => {
    expect(moveByKey(right, 'ArrowRight', LENGTH, SCREEN)).toBe(right);
  });

  it('turns the corner at the end of an edge', () => {
    const topOfRight = wholeOnScreen({ edge: 'right', at: 0 }, LENGTH, SCREEN);
    const turned = moveByKey(topOfRight, 'ArrowUp', LENGTH, SCREEN);
    expect(turned.edge).toBe('top');
    expect(turned.at).toBeGreaterThan(0.9);

    const startOfBottom = wholeOnScreen({ edge: 'bottom', at: 0 }, LENGTH, SCREEN);
    const up = moveByKey(startOfBottom, 'ArrowLeft', LENGTH, SCREEN);
    expect(up.edge).toBe('left');
    expect(up.at).toBeGreaterThan(0.9);
  });

  it('reaches every edge from the default place with the arrow keys alone', () => {
    const seen = new Set<string>();
    let place = DEFAULT_TAB_PLACE;
    for (let i = 0; i < 200; i++) {
      seen.add(place.edge);
      // Up along the right edge, then left along the top, down the left, right along the bottom.
      const key = ({ right: 'ArrowUp', top: 'ArrowLeft', left: 'ArrowDown', bottom: 'ArrowRight' } as const)[place.edge];
      place = moveByKey(place, key, LENGTH, SCREEN);
    }
    expect([...seen].sort()).toEqual(['bottom', 'left', 'right', 'top']);
  });
});

describe('the stored place', () => {
  it('comes back as it was stored', () => {
    writeTabPlace({ edge: 'top', at: 0.2 });
    expect(readTabPlace()).toEqual({ edge: 'top', at: 0.2 });
  });

  it('is the right edge at mid height when nothing valid is stored', () => {
    expect(readTabPlace()).toEqual({ edge: 'right', at: 0.5 });
    localStorage.setItem('formamorph.formaquestion.tab', '{"edge":"middle","at":0.5}');
    expect(readTabPlace()).toEqual(DEFAULT_TAB_PLACE);
    localStorage.setItem('formamorph.formaquestion.tab', '{"edge":"left","at":"high"}');
    expect(readTabPlace()).toEqual(DEFAULT_TAB_PLACE);
  });

  it('does not throw when storage is blocked', () => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    expect(() => writeTabPlace({ edge: 'left', at: 0.5 })).not.toThrow();
    expect(readTabPlace()).toEqual(DEFAULT_TAB_PLACE);
  });
});
