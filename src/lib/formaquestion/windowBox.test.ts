// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boxOf, clampBox, defaultBox, defaultWindow, isWide, moveBox, movePieces, readStoredHeadView, readStoredWindow, resizeBox,
  resizePieces, swapWidth, windowLayout, withBox, writeStoredHeadView, writeStoredWindow,
  MIN_HEIGHT, MIN_WIDTH, NARROW_WIDTH, READER_GAP, READER_WIDTH, WIDE_WIDTH, type StoredWindow, type Viewport, type WindowBox,
} from './windowBox';

const minimalLayout = (box: WindowBox, viewport: Viewport, mascotAspect: number | null, showReader = false) =>
  windowLayout('minimal', box, viewport, { mascotAspect, showReader });
const fullLayout = (box: WindowBox, viewport: Viewport, mascotAspect: number | null) => windowLayout('full', box, viewport, { mascotAspect });

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

describe('the stored window', () => {
  const stored: StoredWindow = { x: 320, y: 140, minimal: { w: 360, h: 600 }, full: { w: 720, h: 480 } };

  it('comes back as it was stored', () => {
    writeStoredWindow(stored);
    expect(readStoredWindow()).toEqual(stored);
  });

  it('starts both chromes at the default box', () => {
    const box = defaultBox(SCREEN);
    const fresh = defaultWindow(SCREEN);
    expect(boxOf(fresh, 'minimal')).toEqual(box);
    expect(boxOf(fresh, 'full')).toEqual(box);
  });

  it('gives each chrome its own size at the one shared place', () => {
    expect(boxOf(stored, 'minimal')).toEqual({ x: 320, y: 140, w: 360, h: 600 });
    expect(boxOf(stored, 'full')).toEqual({ x: 320, y: 140, w: 720, h: 480 });
  });

  it("keeps the other chrome's size when one chrome moves or resizes", () => {
    const next = withBox(stored, 'minimal', { x: 500, y: 90, w: 380, h: 700 });
    expect(next).toEqual({ x: 500, y: 90, minimal: { w: 380, h: 700 }, full: { w: 720, h: 480 } });
    expect(boxOf(next, 'full')).toEqual({ x: 500, y: 90, w: 720, h: 480 });
  });

  it('reads the minimal width at the narrow cap', () => {
    writeStoredWindow({ ...stored, minimal: { w: WIDE_WIDTH, h: 520 } });
    expect(readStoredWindow()!.minimal).toEqual({ w: NARROW_WIDTH, h: 520 });
  });

  it('draws inside a screen that is now smaller', () => {
    writeStoredWindow({ x: 1100, y: 300, minimal: { w: 400, h: 500 }, full: { w: 400, h: 500 } });
    const small = { width: 1000, height: 700 };
    const drawn = fullLayout(boxOf(readStoredWindow()!, 'full'), small, null).column;
    expect(drawn.x + drawn.w).toBeLessThanOrEqual(1000);
    expect(drawn.y + drawn.h).toBeLessThanOrEqual(700);
  });

  it('is null when nothing is stored or the stored value is damaged or of one size', () => {
    expect(readStoredWindow()).toBeNull();
    localStorage.setItem('formamorph.formaquestion.window', JSON.stringify({ x: 300, y: 100, w: WIDE_WIDTH, h: 520 }));
    expect(readStoredWindow()).toBeNull();
    localStorage.setItem('formamorph.formaquestion.window', '{"x":1,"y":2,"w":"wide"}');
    expect(readStoredWindow()).toBeNull();
    localStorage.setItem('formamorph.formaquestion.window', '{"x":1,"y":2,"minimal":{"w":400,"h":500},"full":{"w":400}}');
    expect(readStoredWindow()).toBeNull();
    localStorage.setItem('formamorph.formaquestion.window', 'not json');
    expect(readStoredWindow()).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    expect(() => writeStoredWindow(stored)).not.toThrow();
    expect(readStoredWindow()).toBeNull();
  });
});

describe('the stored head view', () => {
  it('reads full until the head is stored, and comes back as stored', () => {
    expect(readStoredHeadView()).toBe(false);
    writeStoredHeadView(true);
    expect(readStoredHeadView()).toBe(true);
    writeStoredHeadView(false);
    expect(readStoredHeadView()).toBe(false);
  });

  it('reads full and does not throw when storage is blocked', () => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    expect(() => writeStoredHeadView(true)).not.toThrow();
    expect(readStoredHeadView()).toBe(false);
  });
});

describe('the minimal layout', () => {
  const ASPECT = 0.75;

  it('puts the Mascot left of the column at the column height, and the shared box spans both', () => {
    const { column, mascot, group } = minimalLayout({ x: 1100, y: 200, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT);
    expect(column).toEqual({ x: 1100, y: 200, w: NARROW_WIDTH, h: 560 });
    expect(mascot).toEqual({ w: 420, h: 560 });
    expect(group).toEqual({ x: 680, y: 200, w: 420 + NARROW_WIDTH, h: 560 });
  });

  it('caps the column at the narrow width', () => {
    expect(minimalLayout({ x: 800, y: 0, w: WIDE_WIDTH, h: 560 }, SCREEN, ASPECT).column.w).toBe(NARROW_WIDTH);
    expect(minimalLayout({ x: 800, y: 0, w: MIN_WIDTH, h: 560 }, SCREEN, ASPECT).column.w).toBe(MIN_WIDTH);
  });

  it('stands the Mascot right of the column near the left edge, and the shared box spans both', () => {
    const { column, mascot, group, side } = minimalLayout({ x: 100, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT);
    expect(side).toBe('right');
    expect(column.x).toBe(100);
    expect(mascot).toEqual({ w: 420, h: 560 });
    expect(group).toEqual({ x: 100, y: 0, w: NARROW_WIDTH + 420, h: 560 });
  });

  it('stands the Mascot left near the right edge', () => {
    expect(minimalLayout({ x: 1100, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT).side).toBe('left');
  });

  it('keeps the current side on a tie', () => {
    const middle = { x: (SCREEN.width - NARROW_WIDTH) / 2, y: 0, w: NARROW_WIDTH, h: 560 };
    expect(windowLayout('minimal', middle, SCREEN, { mascotAspect: ASPECT, side: 'left' }).side).toBe('left');
    expect(windowLayout('minimal', middle, SCREEN, { mascotAspect: ASPECT, side: 'right' }).side).toBe('right');
  });

  it('gives the side to the wider gap even while the Mascot is not drawn', () => {
    expect(minimalLayout({ x: 100, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, null).side).toBe('right');
  });

  it('keeps the Mascot whole on the screen on its side', () => {
    const { column, group } = minimalLayout({ x: 1300, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT);
    expect(column.x).toBe(SCREEN.width - NARROW_WIDTH);
    expect(group.x).toBe(column.x - 420);
    const right = minimalLayout({ x: 0, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT);
    expect(right.group.x + right.group.w).toBeLessThanOrEqual(SCREEN.width);
  });

  it('keeps the column whole on the right and bottom edges', () => {
    const { column } = minimalLayout({ x: 1500, y: 800, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT);
    expect(column).toMatchObject({ x: SCREEN.width - NARROW_WIDTH, y: SCREEN.height - 560 });
  });

  it('shrinks the Mascot, bottom-aligned, when the screen lacks the room for its full height', () => {
    const narrow = { width: 700, height: 900 };
    const { column, mascot, group } = minimalLayout({ x: 300, y: 100, w: NARROW_WIDTH, h: 560 }, narrow, ASPECT);
    expect(mascot).toEqual({ w: 268, h: 268 / ASPECT });
    expect(group.x).toBeGreaterThanOrEqual(0);
    expect(column.x + column.w).toBeLessThanOrEqual(narrow.width);
  });

  it('is the column alone while the Mascot is not drawn', () => {
    const { column, mascot, group } = minimalLayout({ x: 100, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, null);
    expect(mascot).toBeNull();
    expect(group).toEqual(column);
    expect(column.x).toBe(100);
  });

  it('puts the reader on the side opposite the Mascot', () => {
    const box = { x: 100, y: 0, w: NARROW_WIDTH, h: 560 };
    const { column, mascot, reader, group, side } = minimalLayout(box, SCREEN, ASPECT, true);
    expect(side).toBe('right');
    expect(reader).toEqual({ w: READER_WIDTH, h: 560 });
    expect(column.x).toBe(READER_GAP + READER_WIDTH);
    expect(group.x).toBe(0);
    expect(group.x + group.w).toBe(column.x + column.w + mascot!.w);
  });

  it('puts the reader right of the column at the column height, and the shared box widens by it', () => {
    const box = { x: 800, y: 200, w: NARROW_WIDTH, h: 560 };
    const { column, mascot, reader, group } = minimalLayout(box, SCREEN, ASPECT, true);
    expect(column).toEqual({ x: 800, y: 200, w: NARROW_WIDTH, h: 560 });
    expect(reader).toEqual({ w: READER_WIDTH, h: 560 });
    expect(group.w).toBe(mascot!.w + NARROW_WIDTH + READER_GAP + READER_WIDTH);
    expect(group.x).toBe(column.x - mascot!.w);
  });

  it('keeps the box unchanged while the reader is closed', () => {
    const box = { x: 1000, y: 200, w: NARROW_WIDTH, h: 560 };
    const closed = minimalLayout(box, SCREEN, ASPECT);
    expect(closed.reader).toBeNull();
    expect(closed.group.w).toBe(closed.mascot!.w + NARROW_WIDTH);
  });

  it('moves the column left until the reader is whole on the screen', () => {
    const { column, group } = minimalLayout({ x: 1500, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT, true);
    expect(column.x).toBe(SCREEN.width - NARROW_WIDTH - READER_GAP - READER_WIDTH);
    expect(group.x + group.w).toBe(SCREEN.width);
  });

  it('gives the reader the room first and the Mascot what is left', () => {
    const narrow = { width: 900, height: 900 };
    const { column, mascot, reader, group } = minimalLayout({ x: 450, y: 0, w: NARROW_WIDTH, h: 560 }, narrow, ASPECT, true);
    expect(reader!.w).toBe(READER_WIDTH);
    expect(mascot!.w).toBeLessThan(560 * ASPECT);
    expect(group.x).toBeGreaterThanOrEqual(0);
    expect(group.x + group.w).toBeLessThanOrEqual(narrow.width);
    expect(column.x + column.w + READER_GAP + reader!.w).toBeLessThanOrEqual(narrow.width);
  });
});

describe('movePieces', () => {
  const pieces = { mascotAspect: 0.75 };

  it('stops where the reader would leave the screen', () => {
    const start = { x: 1000, y: 0, w: NARROW_WIDTH, h: 560 };
    expect(movePieces('minimal', start, 500, 0, SCREEN, { ...pieces, showReader: true }).x).toBe(SCREEN.width - NARROW_WIDTH - READER_GAP - READER_WIDTH);
  });

  it('moves the column by the drag and keeps its size', () => {
    const start = { x: 900, y: 200, w: NARROW_WIDTH, h: 560 };
    expect(movePieces('minimal', start, -100, 40, SCREEN, pieces)).toEqual({ x: 800, y: 240, w: NARROW_WIDTH, h: 560 });
  });

  it('stops where the Mascot would leave the screen, beside the column or the frame', () => {
    expect(movePieces('minimal', { x: 1000, y: 0, w: NARROW_WIDTH, h: 560 }, 500, 0, SCREEN, pieces).x).toBe(SCREEN.width - NARROW_WIDTH);
    const nearLeft = { mascotAspect: 0.75, side: 'right' } as const;
    expect(movePieces('full', { x: 500, y: 0, w: WIDE_WIDTH, h: 560 }, -600, 0, SCREEN, nearLeft)).toEqual({ x: 0, y: 0, w: WIDE_WIDTH, h: 560 });
  });
});

describe('the full layout', () => {
  const ASPECT = 0.75;

  it('is the clamped frame alone while the Mascot is not drawn', () => {
    const box = { x: 1500, y: 700, w: 400, h: 400 };
    const { column, mascot, group } = fullLayout(box, SCREEN, null);
    expect(column).toEqual(clampBox(box, SCREEN));
    expect(mascot).toBeNull();
    expect(group).toEqual(column);
  });

  it('puts the Mascot left of the frame at the frame height, past the narrow cap', () => {
    const { column, mascot, group } = fullLayout({ x: 800, y: 100, w: WIDE_WIDTH, h: 600 }, SCREEN, ASPECT);
    expect(column).toEqual({ x: 800, y: 100, w: WIDE_WIDTH, h: 600 });
    expect(mascot).toEqual({ w: 450, h: 600 });
    expect(group).toEqual({ x: 350, y: 100, w: 450 + WIDE_WIDTH, h: 600 });
  });

  it('puts the Mascot right of the frame near the left edge', () => {
    const { column, mascot, group, side } = fullLayout({ x: 100, y: 100, w: WIDE_WIDTH, h: 600 }, SCREEN, ASPECT);
    expect(side).toBe('right');
    expect(column.x).toBe(100);
    expect(group).toEqual({ x: 100, y: 100, w: WIDE_WIDTH + mascot!.w, h: 600 });
  });
});

describe('resizePieces', () => {
  const pieces = { mascotAspect: 0.75 };

  it('stops the minimal column at the narrow cap and keeps its top left corner', () => {
    const start = { x: 800, y: 200, w: MIN_WIDTH, h: 500 };
    expect(resizePieces('minimal', start, 300, 120, SCREEN, pieces)).toEqual({ x: 800, y: 200, w: NARROW_WIDTH, h: 620 });
  });

  it('grows the frame past the narrow cap', () => {
    const start = { x: 800, y: 200, w: NARROW_WIDTH, h: 500 };
    expect(resizePieces('full', start, 300, 120, SCREEN, pieces)).toEqual({ x: 800, y: 200, w: NARROW_WIDTH + 300, h: 620 });
  });
});
