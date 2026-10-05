// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boxOf, clampBox, defaultBox, defaultWindow, isWide, moveBox, movePieces, readStoredHeadView, readStoredWindow, resizeBox,
  resizePieces, swapWidth, windowLayout, withBox, writeStoredHeadView, writeStoredWindow,
  headHeight, readStoredMascotScale, writeStoredMascotScale, readStoredMascotPlacement, writeStoredMascotPlacement, HEAD_HEIGHT, MASCOT_SCALE_MAX, MASCOT_SCALE_MIN, type MascotScale,
  MASCOT_BELOW_CAP, MIN_HEIGHT, MIN_WIDTH, NARROW_WIDTH, READER_GAP, READER_WIDTH, WIDE_WIDTH, type StoredWindow, type Viewport,
  type WindowBox, type WindowPieces,
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

  it('takes 60% of the screen height', () => {
    expect(defaultBox(SCREEN).h).toBe(540);
    expect(defaultBox({ width: 1600, height: 1400 }).h).toBe(840);
  });

  it('stays within the smallest size on a short screen', () => {
    expect(defaultBox({ width: 1600, height: 450 }).h).toBe(MIN_HEIGHT);
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
  const stored: StoredWindow = { x: 320, y: 140, minimal: { w: 360, h: 600 }, full: { w: 720, h: 480 }, bubble: { x: 1300, y: 850 }, chat: { w: 500, h: 300 } };

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
    expect(next).toEqual({ x: 500, y: 90, minimal: { w: 380, h: 700 }, full: { w: 720, h: 480 }, bubble: { x: 1300, y: 850 }, chat: { w: 500, h: 300 } });
    expect(boxOf(next, 'full')).toEqual({ x: 500, y: 90, w: 720, h: 480 });
  });

  it('reads a window stored without a Mascot place as the default place', () => {
    localStorage.setItem('formamorph.formaquestion.window', JSON.stringify({ x: 1, y: 2, minimal: { w: 400, h: 500 }, full: { w: 400, h: 500 } }));
    expect(readStoredWindow()).toMatchObject({ bubble: null, chat: null });
    localStorage.setItem('formamorph.formaquestion.window', JSON.stringify({ x: 1, y: 2, minimal: { w: 400, h: 500 }, full: { w: 400, h: 500 }, bubble: { x: 'left' }, chat: { w: 'wide', h: 300 } }));
    expect(readStoredWindow()).toMatchObject({ bubble: null, chat: null });
  });

  it('reads the minimal width at the narrow cap', () => {
    writeStoredWindow({ ...stored, minimal: { w: WIDE_WIDTH, h: 520 } });
    expect(readStoredWindow()!.minimal).toEqual({ w: NARROW_WIDTH, h: 520 });
  });

  it('draws inside a screen that is now smaller', () => {
    writeStoredWindow({ x: 1100, y: 300, minimal: { w: 400, h: 500 }, full: { w: 400, h: 500 }, bubble: null, chat: null });
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
    const { column, mascot, mascotAt, group } = minimalLayout({ x: 1100, y: 200, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT);
    expect(column).toEqual({ x: 1100, y: 200, w: NARROW_WIDTH, h: 560 });
    expect(mascot).toEqual({ w: 420, h: 560 });
    expect(mascotAt).toEqual({ x: 680, y: 200 });
    expect(group).toEqual({ x: 680, y: 200, w: 420 + NARROW_WIDTH, h: 560 });
  });

  it('caps the column at the narrow width', () => {
    expect(minimalLayout({ x: 800, y: 0, w: WIDE_WIDTH, h: 560 }, SCREEN, ASPECT).column.w).toBe(NARROW_WIDTH);
    expect(minimalLayout({ x: 800, y: 0, w: MIN_WIDTH, h: 560 }, SCREEN, ASPECT).column.w).toBe(MIN_WIDTH);
  });

  it('stands the Mascot right of the column near the left edge, and the shared box spans both', () => {
    const { column, mascot, mascotAt, group, side } = minimalLayout({ x: 100, y: 0, w: NARROW_WIDTH, h: 560 }, SCREEN, ASPECT);
    expect(side).toBe('right');
    expect(column.x).toBe(100);
    expect(mascot).toEqual({ w: 420, h: 560 });
    expect(mascotAt).toEqual({ x: 100 + NARROW_WIDTH, y: 0 });
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

describe('the Mascot scale', () => {
  const ASPECT = 0.75;
  const BASE_HEIGHT = 1200;
  const scaled = (box: WindowBox, scale: MascotScale, viewport: Viewport = SCREEN, chrome: 'minimal' | 'full' = 'minimal') =>
    windowLayout(chrome, box, viewport, { mascotAspect: ASPECT, baseHeight: BASE_HEIGHT, scale });

  it('fits the Mascot to the column height under Auto', () => {
    const box = { x: 1100, y: 200, w: NARROW_WIDTH, h: 560 };
    expect(scaled(box, 'auto').mascot).toEqual({ w: 420, h: 560 });
    expect(scaled({ ...box, h: 700 }, 'auto').mascot).toEqual({ w: 525, h: 700 });
    expect(scaled({ x: 800, y: 100, w: WIDE_WIDTH, h: 600 }, 'auto', SCREEN, 'full').mascot).toEqual({ w: 450, h: 600 });
  });

  it("sizes the Mascot to the percent's share of the base's pixel height, at the base's aspect", () => {
    const { mascot } = scaled({ x: 1100, y: 200, w: NARROW_WIDTH, h: 560 }, 40);
    expect(mascot).toEqual({ w: 360, h: 480 });
    expect(scaled({ x: 1100, y: 200, w: NARROW_WIDTH, h: 300 }, 40).mascot).toEqual({ w: 360, h: 480 });
  });

  it('keeps the shared box at the column while the Mascot is shorter, bottom-aligned', () => {
    const { column, group } = scaled({ x: 1100, y: 200, w: NARROW_WIDTH, h: 560 }, 25);
    expect(group).toEqual({ x: 1100 - 225, y: 200, w: 225 + NARROW_WIDTH, h: 560 });
    expect(column).toEqual({ x: 1100, y: 200, w: NARROW_WIDTH, h: 560 });
  });

  it('rises above a shorter column and leaves the column where it is', () => {
    const { column, mascot, group } = scaled({ x: 1100, y: 400, w: NARROW_WIDTH, h: 400 }, 50);
    expect(column).toEqual({ x: 1100, y: 400, w: NARROW_WIDTH, h: 400 });
    expect(mascot).toEqual({ w: 450, h: 600 });
    expect(group).toEqual({ x: 1100 - 450, y: 200, w: 450 + NARROW_WIDTH, h: 600 });
  });

  it("clamps a tall percent to the room from the column's bottom up to the screen margin", () => {
    const { column, mascot, group } = scaled({ x: 1100, y: 300, w: NARROW_WIDTH, h: 400 }, 150);
    expect(column.y).toBe(300);
    expect(mascot!.h).toBe(300 + 400 - 16);
    expect(mascot!.w).toBeCloseTo(mascot!.h * ASPECT);
    expect(group.y).toBe(16);
  });

  it('never clamps a percent below the column height', () => {
    expect(scaled({ x: 1100, y: 0, w: NARROW_WIDTH, h: 560 }, 50).mascot).toEqual({ w: 420, h: 560 });
  });

  it('clamps a wide percent to the room beside the column, at the aspect', () => {
    const narrow = { width: 700, height: 900 };
    const { mascot, group } = scaled({ x: 300, y: 100, w: NARROW_WIDTH, h: 560 }, 150, narrow);
    expect(mascot).toEqual({ w: 268, h: 268 / ASPECT });
    expect(group.x).toBeGreaterThanOrEqual(0);
  });

  it('fits the column under a percent while the base size is unknown', () => {
    expect(windowLayout('minimal', { x: 1100, y: 200, w: NARROW_WIDTH, h: 560 }, SCREEN, { mascotAspect: ASPECT, scale: 40 }).mascot).toEqual({ w: 420, h: 560 });
  });

  it('scales the head view with the percent, at most the column height, and keeps the fixed height under Auto', () => {
    expect(headHeight('auto', 300, 560)).toBe(HEAD_HEIGHT);
    expect(headHeight(50, 300, 560)).toBe(150);
    expect(headHeight(150, 300, 560)).toBe(450);
    expect(headHeight(150, 680, 560)).toBe(560);
  });
});

describe('the stored Mascot scale', () => {
  it('reads Auto until a percent is stored, and comes back as stored', () => {
    expect(readStoredMascotScale()).toBe('auto');
    writeStoredMascotScale(75);
    expect(readStoredMascotScale()).toBe(75);
    writeStoredMascotScale('auto');
    expect(readStoredMascotScale()).toBe('auto');
  });

  it('clamps a stored percent to the slider range and reads damage as Auto', () => {
    localStorage.setItem('formamorph.formaquestion.mascotScale', '400');
    expect(readStoredMascotScale()).toBe(MASCOT_SCALE_MAX);
    localStorage.setItem('formamorph.formaquestion.mascotScale', '3');
    expect(readStoredMascotScale()).toBe(MASCOT_SCALE_MIN);
    localStorage.setItem('formamorph.formaquestion.mascotScale', 'big');
    expect(readStoredMascotScale()).toBe('auto');
    localStorage.setItem('formamorph.formaquestion.mascotScale', '');
    expect(readStoredMascotScale()).toBe('auto');
  });

  it('reads Auto and does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => writeStoredMascotScale(50)).not.toThrow();
    expect(readStoredMascotScale()).toBe('auto');
  });
});

describe('the Mascot below', () => {
  const ASPECT = 0.75;
  const BASE_HEIGHT = 1200;
  const CAP = SCREEN.height * MASCOT_BELOW_CAP;
  const BOTTOM = SCREEN.height - 16;
  const below = (box: WindowBox, extra: Partial<WindowPieces> = {}, chrome: 'minimal' | 'full' = 'minimal', viewport: Viewport = SCREEN) =>
    windowLayout(chrome, box, viewport, { mascotAspect: ASPECT, placement: 'below', ...extra });

  it('stands her under the column at the room height, the group bottom at the screen margin', () => {
    const { column, mascot, mascotAt, group, placement } = below({ x: 1100, y: 100, w: NARROW_WIDTH, h: 400 });
    expect(placement).toBe('below');
    expect(column).toEqual({ x: 1100, y: 100, w: NARROW_WIDTH, h: 400 });
    expect(mascot).toEqual({ w: 384 * ASPECT, h: 384 });
    expect(mascotAt).toEqual({ x: 1100 + (NARROW_WIDTH - 384 * ASPECT) / 2, y: BOTTOM - 384 });
    expect(group).toEqual({ x: 1100, y: 100, w: NARROW_WIDTH, h: BOTTOM - 100 });
  });

  it('draws the same variant under the frame', () => {
    const { column, mascot, group } = below({ x: 600, y: 100, w: WIDE_WIDTH, h: 400 }, {}, 'full');
    expect(column).toEqual({ x: 600, y: 100, w: WIDE_WIDTH, h: 400 });
    expect(mascot).toEqual({ w: 384 * ASPECT, h: 384 });
    expect(group.y + group.h).toBe(BOTTOM);
  });

  it('stands below at the cap and beside one pixel over under Auto', () => {
    const at = { x: 1100, y: 0, w: NARROW_WIDTH, h: CAP };
    expect(windowLayout('minimal', at, SCREEN, { mascotAspect: ASPECT, placement: 'auto' }).placement).toBe('below');
    expect(windowLayout('minimal', { ...at, h: CAP + 1 }, SCREEN, { mascotAspect: ASPECT, placement: 'auto' }).placement).toBe('beside');
  });

  it('stands beside under Beside at any height', () => {
    expect(below({ x: 1100, y: 0, w: NARROW_WIDTH, h: 400 }, { placement: 'beside' }).placement).toBe('beside');
  });

  it('caps the column at the cap', () => {
    expect(below({ x: 1100, y: 0, w: NARROW_WIDTH, h: 800 }).column.h).toBe(CAP);
  });

  it('stops a resize past the cap at the cap', () => {
    const start = { x: 1100, y: 0, w: NARROW_WIDTH, h: 500 };
    expect(resizePieces('minimal', start, 0, 300, SCREEN, { mascotAspect: ASPECT, placement: 'below' })).toEqual({ ...start, h: CAP });
  });

  it('keeps her room at what the cap leaves when the column drags to the screen bottom', () => {
    const { column, mascot } = below({ x: 1100, y: 800, w: NARROW_WIDTH, h: 400 });
    expect(column.y + column.h).toBe(BOTTOM - (BOTTOM - CAP));
    expect(mascot!.h).toBe(BOTTOM - CAP);
    const moved = movePieces('minimal', { x: 1100, y: 100, w: NARROW_WIDTH, h: 400 }, 0, 700, SCREEN, { mascotAspect: ASPECT, placement: 'below' });
    expect(moved.y).toBe(column.y);
  });

  it('sits the column at the top at the cap height', () => {
    expect(below({ x: 1100, y: 300, w: NARROW_WIDTH, h: 800 }).column.y).toBe(0);
  });

  it('stands a percent Mascot at the bottom, and drops the column no further than lets her fit', () => {
    const fits = below({ x: 1100, y: 100, w: NARROW_WIDTH, h: 400 }, { scale: 25, baseHeight: BASE_HEIGHT });
    expect(fits.mascot).toEqual({ w: 225, h: 300 });
    expect(fits.group.y + fits.group.h).toBe(BOTTOM);
    expect(below({ x: 1100, y: 500, w: NARROW_WIDTH, h: 400 }, { scale: 25, baseHeight: BASE_HEIGHT }).column.y).toBe(BOTTOM - 400 - 300);
  });

  it('clamps a tall percent to the room under the column at the top', () => {
    const { column, mascot } = below({ x: 1100, y: 300, w: NARROW_WIDTH, h: 400 }, { scale: 150, baseHeight: BASE_HEIGHT });
    expect(column.y).toBe(0);
    expect(column.h).toBe(400);
    expect(mascot!.h).toBe(BOTTOM - 400);
  });

  it('centers her under the column and keeps her whole on the screen', () => {
    const { column, mascot, group } = below({ x: 0, y: 0, w: NARROW_WIDTH, h: MIN_HEIGHT });
    expect(mascot!.w).toBeGreaterThan(NARROW_WIDTH);
    const hang = (mascot!.w - NARROW_WIDTH) / 2;
    expect(column.x).toBe(hang);
    expect(group.x).toBe(0);
    expect(group.w).toBe(mascot!.w);
  });

  it('narrows her to the screen at her aspect', () => {
    const narrow = { width: 500, height: 1400 };
    const { mascot, group } = below({ x: 50, y: 0, w: NARROW_WIDTH, h: MIN_HEIGHT }, {}, 'minimal', narrow);
    expect(mascot!.w).toBe(500 - 32);
    expect(mascot!.h).toBe(mascot!.w / ASPECT);
    expect(group.x).toBeGreaterThanOrEqual(0);
    expect(group.x + group.w).toBeLessThanOrEqual(500);
  });

  it('keeps the reader beside the column at its height, on the wider side', () => {
    const { column, reader, readerSide, group } = below({ x: 100, y: 100, w: NARROW_WIDTH, h: 400 }, { showReader: true });
    expect(readerSide).toBe('right');
    expect(reader).toEqual({ w: READER_WIDTH, h: 400 });
    expect(group.x + group.w).toBe(column.x + column.w + READER_GAP + READER_WIDTH);
    const left = below({ x: 1100, y: 100, w: NARROW_WIDTH, h: 400 }, { showReader: true });
    expect(left.readerSide).toBe('left');
    expect(left.group.x).toBe(left.column.x - READER_GAP - READER_WIDTH);
  });

  it('keeps the reader whole on the screen', () => {
    const { column } = below({ x: 1500, y: 100, w: NARROW_WIDTH, h: 400 }, { showReader: true, side: 'left' });
    expect(column.x - READER_GAP - READER_WIDTH).toBeGreaterThanOrEqual(0);
    const right = below({ x: 0, y: 100, w: NARROW_WIDTH, h: 400 }, { showReader: true });
    expect(right.column.x + right.column.w + READER_GAP + READER_WIDTH).toBeLessThanOrEqual(SCREEN.width);
  });

  it('stands beside at the smallest column height on a screen whose cap is under it', () => {
    const short = { width: 1600, height: 420 };
    const { column, placement } = below({ x: 1100, y: 0, w: NARROW_WIDTH, h: MIN_HEIGHT }, {}, 'minimal', short);
    expect(placement).toBe('beside');
    expect(column.h).toBe(MIN_HEIGHT);
  });

  it('is the Beside layout, uncapped, while no whole Mascot is drawn', () => {
    const { column, placement, group } = windowLayout('minimal', { x: 1100, y: 0, w: NARROW_WIDTH, h: 800 }, SCREEN, { mascotAspect: null, placement: 'below' });
    expect(placement).toBe('beside');
    expect(column.h).toBe(800);
    expect(group).toEqual(column);
  });
});

describe('the stored Mascot placement', () => {
  it('reads Auto until a placement is stored, and comes back as stored', () => {
    expect(readStoredMascotPlacement()).toBe('auto');
    writeStoredMascotPlacement('below');
    expect(readStoredMascotPlacement()).toBe('below');
    writeStoredMascotPlacement('beside');
    expect(readStoredMascotPlacement()).toBe('beside');
    writeStoredMascotPlacement('auto');
    expect(readStoredMascotPlacement()).toBe('auto');
  });

  it('reads damage as Auto', () => {
    localStorage.setItem('formamorph.formaquestion.mascotPlacement', 'above');
    expect(readStoredMascotPlacement()).toBe('auto');
    localStorage.setItem('formamorph.formaquestion.mascotPlacement', '');
    expect(readStoredMascotPlacement()).toBe('auto');
  });

  it('reads Auto and does not throw when storage is blocked', () => {
    writeStoredMascotPlacement('below');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => writeStoredMascotPlacement('beside')).not.toThrow();
    expect(readStoredMascotPlacement()).toBe('auto');
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
