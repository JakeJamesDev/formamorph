// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampBox, defaultBox, isWide, moveBox, readStoredBox, resizeBox, swapWidth, writeStoredBox,
  MIN_HEIGHT, MIN_WIDTH, NARROW_WIDTH, WIDE_WIDTH,
} from './windowBox';

const SCREEN = { width: 1600, height: 900 };

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('clampBox', () => {
  it('leaves a box that is whole on the screen where it is', () => {
    const box = { x: 300, y: 120, w: 420, h: 500 };
    expect(clampBox(box, SCREEN)).toEqual(box);
  });

  it('moves a box that hangs off an edge back inside the screen', () => {
    expect(clampBox({ x: 1500, y: 700, w: 400, h: 400 }, SCREEN)).toMatchObject({ x: 1200, y: 500 });
    expect(clampBox({ x: -80, y: -40, w: 400, h: 400 }, SCREEN)).toMatchObject({ x: 0, y: 0 });
  });

  it('does not go under the smallest size', () => {
    expect(clampBox({ x: 0, y: 0, w: 50, h: 50 }, SCREEN)).toMatchObject({ w: MIN_WIDTH, h: MIN_HEIGHT });
  });

  it('shrinks a box that is larger than the screen', () => {
    const fitted = clampBox({ x: 0, y: 0, w: 5000, h: 5000 }, SCREEN);
    expect(fitted.w).toBeLessThan(SCREEN.width);
    expect(fitted.h).toBeLessThan(SCREEN.height);
    expect(fitted.x + fitted.w).toBeLessThanOrEqual(SCREEN.width);
    expect(fitted.y + fitted.h).toBeLessThanOrEqual(SCREEN.height);
  });
});

describe('defaultBox', () => {
  it('is the narrow window, whole on the screen, clear of the right edge', () => {
    const box = defaultBox(SCREEN);
    expect(box.w).toBe(NARROW_WIDTH);
    expect(isWide(box)).toBe(false);
    expect(box.x + box.w).toBeLessThan(SCREEN.width - 32);
    expect(box.y + box.h).toBeLessThanOrEqual(SCREEN.height);
  });

  it('fits a screen smaller than its default size', () => {
    const small = { width: 800, height: 420 };
    const box = defaultBox(small);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.h).toBeLessThanOrEqual(small.height);
  });
});

describe('swapWidth', () => {
  it('widens a window on the right half to the left, with its right edge in place', () => {
    const narrow = { x: 1100, y: 200, w: NARROW_WIDTH, h: 560 };
    const wide = swapWidth(narrow, SCREEN);
    expect(wide.w).toBe(WIDE_WIDTH);
    expect(wide.x + wide.w).toBe(narrow.x + narrow.w);
    expect(isWide(wide)).toBe(true);
  });

  it('widens a window on the left half to the right, with its left edge in place', () => {
    const wide = swapWidth({ x: 40, y: 200, w: NARROW_WIDTH, h: 560 }, SCREEN);
    expect(wide).toMatchObject({ x: 40, w: WIDE_WIDTH });
  });

  it('returns a wide window to the narrow width', () => {
    expect(swapWidth({ x: 40, y: 200, w: 900, h: 560 }, SCREEN).w).toBe(NARROW_WIDTH);
  });
});

describe('moveBox and resizeBox', () => {
  const start = { x: 600, y: 200, w: 400, h: 500 };

  it('moves by the drag distance and stops at the screen edge', () => {
    expect(moveBox(start, 50, -30, SCREEN)).toEqual({ ...start, x: 650, y: 170 });
    expect(moveBox(start, 5000, 5000, SCREEN)).toMatchObject({ x: SCREEN.width - 400, y: SCREEN.height - 500 });
  });

  it('resizes from the bottom right corner and keeps the top left corner', () => {
    expect(resizeBox(start, 100, 60, SCREEN)).toEqual({ ...start, w: 500, h: 560 });
    const largest = resizeBox(start, 5000, 5000, SCREEN);
    expect(largest).toMatchObject({ x: 600, y: 200 });
    expect(largest.x + largest.w).toBeLessThanOrEqual(SCREEN.width);
    expect(largest.y + largest.h).toBeLessThanOrEqual(SCREEN.height);
  });
});

describe('the stored box', () => {
  it('comes back as it was stored', () => {
    const box = { x: 320, y: 140, w: 720, h: 480 };
    writeStoredBox(box);
    expect(readStoredBox(SCREEN)).toEqual(box);
  });

  it('comes back inside a screen that is now smaller', () => {
    writeStoredBox({ x: 1100, y: 300, w: 400, h: 500 });
    const fitted = readStoredBox({ width: 1000, height: 700 })!;
    expect(fitted.x + fitted.w).toBeLessThanOrEqual(1000);
    expect(fitted.y + fitted.h).toBeLessThanOrEqual(700);
  });

  it('is null when nothing is stored or the stored value is damaged', () => {
    expect(readStoredBox(SCREEN)).toBeNull();
    localStorage.setItem('formamorph.formaquestion.window', '{"x":1,"y":2,"w":"wide"}');
    expect(readStoredBox(SCREEN)).toBeNull();
    localStorage.setItem('formamorph.formaquestion.window', 'not json');
    expect(readStoredBox(SCREEN)).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    expect(() => writeStoredBox({ x: 0, y: 0, w: 400, h: 400 })).not.toThrow();
    expect(readStoredBox(SCREEN)).toBeNull();
  });
});
