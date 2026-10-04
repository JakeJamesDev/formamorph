/** The Formaquestion window's place and size on the screen, in CSS pixels, and where the device keeps them. */

export interface WindowBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 320;
/** The window shows its wide layout from this width. The Wide View button and the resize grip both cross it. */
export const WIDE_FROM = 560;
export const NARROW_WIDTH = 400;
export const WIDE_WIDTH = 720;
const DEFAULT_HEIGHT = 560;
/** Space the window keeps from the screen edge at its default place and at its largest size. */
const SCREEN_MARGIN = 16;
/** Room the default place leaves for the Help tab, which starts on the right edge. */
const TAB_CLEARANCE = 44;
/** Room the default place leaves for the controls in a screen's bottom corner. */
const CORNER_CLEARANCE = 72;

const STORAGE_KEY = 'formamorph.formaquestion.window';

export function viewportOf(win: Pick<Window, 'innerWidth' | 'innerHeight'>): Viewport {
  return { width: win.innerWidth, height: win.innerHeight };
}

/** The box at a legal size and whole on the screen. Inside the screen it keeps its place. */
export function clampBox(box: WindowBox, viewport: Viewport): WindowBox {
  const w = Math.min(Math.max(box.w, MIN_WIDTH), viewport.width - SCREEN_MARGIN * 2);
  const h = Math.min(Math.max(box.h, MIN_HEIGHT), viewport.height - SCREEN_MARGIN * 2);
  return {
    w,
    h,
    x: Math.min(Math.max(box.x, 0), viewport.width - w),
    y: Math.min(Math.max(box.y, 0), viewport.height - h),
  };
}

/** The narrow window at the bottom right, clear of the Help tab. */
export function defaultBox(viewport: Viewport): WindowBox {
  return clampBox({
    w: NARROW_WIDTH,
    h: DEFAULT_HEIGHT,
    x: viewport.width - NARROW_WIDTH - TAB_CLEARANCE,
    y: viewport.height - DEFAULT_HEIGHT - CORNER_CLEARANCE,
  }, viewport);
}

export function isWide(box: WindowBox): boolean {
  return box.w >= WIDE_FROM;
}

/** The box at the other width. The edge nearer the screen side stays put, so it widens toward open space. */
export function swapWidth(box: WindowBox, viewport: Viewport): WindowBox {
  const w = isWide(box) ? NARROW_WIDTH : WIDE_WIDTH;
  const anchorRight = box.x + box.w / 2 > viewport.width / 2;
  return clampBox({ ...box, w, x: anchorRight ? box.x + box.w - w : box.x }, viewport);
}

/** The box a title bar drag of (dx, dy) gives, from where the drag started. */
export function moveBox(start: WindowBox, dx: number, dy: number, viewport: Viewport): WindowBox {
  return clampBox({ ...start, x: start.x + dx, y: start.y + dy }, viewport);
}

/** The box a corner grip drag of (dx, dy) gives. The top left corner stays put. */
export function resizeBox(start: WindowBox, dx: number, dy: number, viewport: Viewport): WindowBox {
  return clampBox({
    ...start,
    w: Math.min(start.w + dx, viewport.width - start.x),
    h: Math.min(start.h + dy, viewport.height - start.y),
  }, viewport);
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** The reader piece's width, and the gap between it and the column. */
export const READER_WIDTH = 360;
export const READER_GAP = 8;

/** The minimal chrome's pieces: the chat column, the Mascot bottom-aligned at its left, the reader at its right. */
export interface MinimalLayout {
  /** The stored box's part: it moves, and the device keeps it. */
  readonly column: WindowBox;
  readonly mascot: { readonly w: number; readonly h: number } | null;
  readonly reader: { readonly w: number; readonly h: number } | null;
  /** The box the pieces share: the column, widened left by the Mascot and right by the reader. */
  readonly group: WindowBox;
}

/**
 * The pieces for a stored box. The column takes the box's height and at most the narrow width. The reader
 * takes the room it needs, then the Mascot takes the column's height at its aspect, less when the screen
 * lacks the room. All stay whole on the screen.
 */
export function minimalLayout(box: WindowBox, viewport: Viewport, mascotAspect: number | null, showReader = false): MinimalLayout {
  const w = clamp(Math.min(box.w, NARROW_WIDTH), MIN_WIDTH, viewport.width - SCREEN_MARGIN * 2);
  const h = clamp(box.h, MIN_HEIGHT, viewport.height - SCREEN_MARGIN * 2);
  const room = Math.max(0, viewport.width - SCREEN_MARGIN * 2 - w);
  const readerSpace = showReader ? Math.min(READER_GAP + READER_WIDTH, room) : 0;
  const readerW = Math.max(0, readerSpace - READER_GAP);
  const mascotW = mascotAspect ? Math.min(h * mascotAspect, room - readerSpace) : 0;
  const x = clamp(box.x, mascotW, viewport.width - w - readerSpace);
  const y = clamp(box.y, 0, viewport.height - h);
  return {
    column: { x, y, w, h },
    mascot: mascotAspect && mascotW > 0 ? { w: mascotW, h: mascotW / mascotAspect } : null,
    reader: readerW > 0 ? { w: readerW, h } : null,
    group: { x: x - mascotW, y, w: w + mascotW + readerSpace, h },
  };
}

/**
 * The box a pill drag of (dx, dy) gives, from where the drag started. The column's place moves; the box
 * keeps its own width and height, so the framed window comes back at its size.
 */
export function moveColumn(start: WindowBox, dx: number, dy: number, viewport: Viewport, mascotAspect: number | null, showReader = false): WindowBox {
  const { column } = minimalLayout({ ...start, x: start.x + dx, y: start.y + dy }, viewport, mascotAspect, showReader);
  return { ...start, x: column.x, y: column.y };
}

const isBox = (value: unknown): value is WindowBox =>
  typeof value === 'object' && value !== null
  && (['x', 'y', 'w', 'h'] as const).every((key) => Number.isFinite((value as Record<string, unknown>)[key]));

/** The box this device stored, fitted to the screen, or null when none is stored or storage is blocked. */
export function readStoredBox(viewport: Viewport): WindowBox | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isBox(stored) ? clampBox({ x: stored.x, y: stored.y, w: stored.w, h: stored.h }, viewport) : null;
  } catch {
    return null;
  }
}

/** Stores the box on this device. With storage blocked, the box lasts for this visit only. */
export function writeStoredBox(box: WindowBox): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(box));
  } catch { /* blocked storage */ }
}
