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
/** The default window's share of the screen height. */
const DEFAULT_HEIGHT_SHARE = 0.6;
/** Space the window keeps from the screen edge at its default place and at its largest size. */
export const SCREEN_MARGIN = 16;
/** Room the default place leaves for the Help tab, which starts on the right edge. */
export const TAB_CLEARANCE = 44;
/** Room the default place leaves for the controls in a screen's bottom corner. */
export const CORNER_CLEARANCE = 72;

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
  const h = viewport.height * DEFAULT_HEIGHT_SHARE;
  return clampBox({
    w: NARROW_WIDTH,
    h,
    x: viewport.width - NARROW_WIDTH - TAB_CLEARANCE,
    y: viewport.height - h - CORNER_CLEARANCE,
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

/** The window's chromes: the Mascot speaking from a bubble, the bare chat column, and the framed window. */
export type WindowChrome = 'bubble' | 'minimal' | 'full';

/** The chromes whose window is a box the device keeps. Bubble keeps her place only. */
export type BoxChrome = Exclude<WindowChrome, 'bubble'>;

/** A side of the column or frame, for the Mascot beside it or the reader. */
export type MascotSide = 'left' | 'right';

/** Where the Mascot stands: beside the column, under it, or under it while the column is at most the cap. */
export type MascotPlacement = 'beside' | 'below' | 'auto';

/** The column's largest share of the screen height while the Mascot stands below it. Auto stands her below at or under it. */
export const MASCOT_BELOW_CAP = 0.75;

/** The pieces drawn around the column or frame. */
export interface WindowPieces {
  /** The whole Mascot's aspect, or null while it is not drawn. */
  readonly mascotAspect: number | null;
  /** Where the Mascot stands. Defaults to beside. */
  readonly placement?: MascotPlacement;
  /** The reader piece, which only the minimal chrome draws. */
  readonly showReader?: boolean;
  /** The side the Mascot stands on now. It decides a tie between the two gaps. Defaults to left. */
  readonly side?: MascotSide;
  /** The Mascot's size. Defaults to Auto. */
  readonly scale?: MascotScale;
  /** The base's natural pixel height, which a percent scale takes its share of. Unknown fits the column. */
  readonly baseHeight?: number;
}

/** The pieces on the screen: the column or frame, the Mascot bottom-aligned beside or under it, and the reader beside it. */
export interface WindowLayout {
  /** The stored box's part: it moves, and the device keeps it. */
  readonly column: WindowBox;
  readonly mascot: { readonly w: number; readonly h: number } | null;
  /** The Mascot's top left corner on the screen, or null while she is not drawn. */
  readonly mascotAt: { readonly x: number; readonly y: number } | null;
  readonly reader: { readonly w: number; readonly h: number } | null;
  /** Where the Mascot stands this frame. Below, she is centered under the column. */
  readonly placement: Exclude<MascotPlacement, 'auto'>;
  /** The side with the wider free gap. Beside, the Mascot stands there; the head view stands at the matching end of the pill. */
  readonly side: MascotSide;
  /** The side the reader stands on, at the column's height. */
  readonly readerSide: MascotSide;
  /** The box the pieces share. Below, its bottom edge sits at the screen margin. */
  readonly group: WindowBox;
}

/** The side with the wider free gap between the column and the screen edge. A tie keeps `current`. */
function widerSide(x: number, w: number, viewport: Viewport, current: MascotSide): MascotSide {
  const right = viewport.width - x - w;
  if (x === right) return current;
  return x > right ? 'left' : 'right';
}

/**
 * The pieces for a stored box. The column takes the box's height, and under the minimal chrome at most the
 * narrow width. The Mascot stands on the side with the wider free gap. The reader takes the room it needs on
 * the other side, then the Mascot takes its scale's height at its aspect, less when the screen lacks the
 * room. A percent Mascot taller than the column rises above it; the column never moves for it (Q37). All
 * stay whole on the screen. Below, or Auto at or under the cap, a whole Mascot stands under a column at most
 * the cap's height instead.
 */
export function windowLayout(chrome: BoxChrome, box: WindowBox, viewport: Viewport, pieces: WindowPieces): WindowLayout {
  const { mascotAspect, showReader = false, side: previous = 'left', scale = 'auto', baseHeight, placement = 'beside' } = pieces;
  const w = clamp(chrome === 'minimal' ? Math.min(box.w, NARROW_WIDTH) : box.w, MIN_WIDTH, viewport.width - SCREEN_MARGIN * 2);
  const h = clamp(box.h, MIN_HEIGHT, viewport.height - SCREEN_MARGIN * 2);
  const side = widerSide(clamp(box.x, 0, viewport.width - w), w, viewport, previous);
  const room = Math.max(0, viewport.width - SCREEN_MARGIN * 2 - w);
  const readerSpace = showReader && chrome === 'minimal' ? Math.min(READER_GAP + READER_WIDTH, room) : 0;
  const readerW = Math.max(0, readerSpace - READER_GAP);
  const cap = viewport.height * MASCOT_BELOW_CAP;
  // Below needs a whole Mascot and a cap the smallest column fits under (Q12, Q13); the snap has no hysteresis (Q3).
  if (mascotAspect && cap >= MIN_HEIGHT && (placement === 'below' || (placement === 'auto' && h <= cap))) {
    return belowLayout({ ...box, w, h: Math.min(h, cap) }, viewport, { aspect: mascotAspect, cap, side, readerSpace, readerW, scale, baseHeight });
  }
  const y = clamp(box.y, 0, viewport.height - h);
  const wantedH = scale === 'auto' || !baseHeight ? h : Math.min((baseHeight * scale) / 100, Math.max(h, y + h - SCREEN_MARGIN));
  const mascotW = mascotAspect ? Math.min(wantedH * mascotAspect, room - readerSpace) : 0;
  const mascot = mascotAspect && mascotW > 0 ? { w: mascotW, h: mascotW / mascotAspect } : null;
  const before = side === 'left' ? mascotW : readerSpace;
  const after = side === 'left' ? readerSpace : mascotW;
  const x = clamp(box.x, before, viewport.width - w - after);
  const groupH = Math.max(h, mascot?.h ?? 0);
  return {
    column: { x, y, w, h },
    mascot,
    mascotAt: mascot && { x: side === 'left' ? x - mascot.w : x + w, y: y + h - mascot.h },
    reader: readerW > 0 ? { w: readerW, h } : null,
    placement: 'beside',
    side,
    readerSide: side === 'left' ? 'right' : 'left',
    group: { x: x - before, y: y + h - groupH, w: w + before + after, h: groupH },
  };
}

interface BelowPieces {
  readonly aspect: number;
  readonly cap: number;
  readonly side: MascotSide;
  readonly readerSpace: number;
  readonly readerW: number;
  readonly scale: MascotScale;
  readonly baseHeight?: number;
}

/**
 * The column over the Mascot, the group's bottom edge at the screen margin. Under Auto scale she fills the room under
 * the column, and the column stops where that room would drop under what the cap leaves. A percent Mascot
 * clamps the column's top so she fits, and takes the room when even the top lacks it (Q6). She centers under
 * the column; the reader stands on the wider side (Q7).
 */
function belowLayout(box: WindowBox, viewport: Viewport, pieces: BelowPieces): WindowLayout {
  const { aspect, cap, side, readerSpace, readerW, scale, baseHeight } = pieces;
  const { w, h } = box;
  const bottom = viewport.height - SCREEN_MARGIN;
  const asked = scale === 'auto' || !baseHeight ? null : (baseHeight * scale) / 100;
  const keep = asked === null ? bottom - cap : Math.min(asked, bottom - h);
  const y = clamp(box.y, 0, bottom - h - keep);
  const roomH = bottom - y - h;
  // The reader takes its room first; she may hang past the column only into what is left on both sides.
  const overhang = Math.max(0, Math.min((viewport.width - SCREEN_MARGIN * 2 - w) / 2, viewport.width - w - readerSpace));
  const mascotW = Math.max(0, Math.min((asked === null ? roomH : Math.min(asked, roomH)) * aspect, w + overhang * 2));
  const mascot = mascotW > 0 ? { w: mascotW, h: mascotW / aspect } : null;
  const hang = Math.max(0, (mascotW - w) / 2);
  const readerLeft = side === 'left' ? readerSpace : 0;
  const readerRight = side === 'right' ? readerSpace : 0;
  const x = clamp(box.x, Math.max(hang, readerLeft), viewport.width - w - Math.max(hang, readerRight));
  const left = Math.min(x - readerLeft, x - hang);
  const right = Math.max(x + w + readerRight, x + w + hang);
  return {
    column: { x, y, w, h },
    mascot,
    mascotAt: mascot && { x: x + (w - mascot.w) / 2, y: bottom - mascot.h },
    reader: readerW > 0 ? { w: readerW, h } : null,
    placement: 'below',
    side,
    readerSide: side,
    group: { x: left, y, w: right - left, h: mascot ? bottom - y : h },
  };
}

/** The column or frame a pill or title bar drag of (dx, dy) gives, from where the drag started. The pieces stay whole on the screen. */
export function movePieces(chrome: BoxChrome, start: WindowBox, dx: number, dy: number, viewport: Viewport, pieces: WindowPieces): WindowBox {
  return windowLayout(chrome, moveBox(start, dx, dy, viewport), viewport, pieces).column;
}

/** The column or frame a corner grip drag of (dx, dy) gives. The top left corner stays put while the pieces have room. */
export function resizePieces(chrome: BoxChrome, start: WindowBox, dx: number, dy: number, viewport: Viewport, pieces: WindowPieces): WindowBox {
  return windowLayout(chrome, resizeBox(start, dx, dy, viewport), viewport, pieces).column;
}

export interface WindowSize {
  readonly w: number;
  readonly h: number;
}

/** Where the Mascot stands under Bubble: the middle of her feet, or of her head in head view. */
export interface BubblePoint {
  readonly x: number;
  readonly y: number;
}

/** What the device keeps: one place and a size for each box chrome (Q11), and her place under Bubble, null for the default (Q15). */
export interface StoredWindow {
  readonly x: number;
  readonly y: number;
  readonly minimal: WindowSize;
  readonly full: WindowSize;
  readonly bubble: BubblePoint | null;
  /** The Bubble chrome's chat size from its grip, or null for the default width and a bubble that fits its answer (Q19). */
  readonly chat: WindowSize | null;
}

/** The chrome's box: the shared place at that chrome's size. */
export const boxOf = (stored: StoredWindow, chrome: BoxChrome): WindowBox => ({ x: stored.x, y: stored.y, ...stored[chrome] });

/** The stored window after the chrome moved or resized to `box`. The other chrome keeps its size. */
export const withBox = (stored: StoredWindow, chrome: BoxChrome, { x, y, w, h }: WindowBox): StoredWindow => ({ ...stored, x, y, [chrome]: { w, h } });

/** Both box chromes at the default box, and the Mascot at her default place. */
export function defaultWindow(viewport: Viewport): StoredWindow {
  const { x, y, w, h } = defaultBox(viewport);
  return { x, y, minimal: { w, h }, full: { w, h }, bubble: null, chat: null };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const hasNumbers = <K extends string>(value: unknown, keys: readonly K[]): value is Record<string, unknown> & Record<K, number> =>
  isRecord(value) && keys.every((key) => Number.isFinite(value[key]));

/** The window this device stored, or null when none is stored, it is damaged, or storage is blocked. The drawn layout fits it to the screen. */
export function readStoredWindow(): StoredWindow | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!hasNumbers(stored, ['x', 'y'] as const)) return null;
    const { x, y, minimal, full, bubble, chat } = stored;
    if (!hasNumbers(minimal, ['w', 'h'] as const) || !hasNumbers(full, ['w', 'h'] as const)) return null;
    return {
      x,
      y,
      minimal: { w: Math.min(minimal.w, NARROW_WIDTH), h: minimal.h },
      full: { w: full.w, h: full.h },
      bubble: hasNumbers(bubble, ['x', 'y'] as const) ? { x: bubble.x, y: bubble.y } : null,
      chat: hasNumbers(chat, ['w', 'h'] as const) ? { w: chat.w, h: chat.h } : null,
    };
  } catch {
    return null;
  }
}

/** Stores the window on this device. With storage blocked, it lasts for this visit only. */
export function writeStoredWindow(stored: StoredWindow): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* blocked storage */ }
}

interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Whether a conversation shows its scroll arrow: the end is more than half a viewport height away. */
export function showsScrollArrow({ scrollTop, scrollHeight, clientHeight }: ScrollPosition): boolean {
  return scrollHeight - scrollTop - clientHeight > clientHeight / 2;
}

/** The head view's height left of the pill: on the desktop, and on the mobile sheet. Its width follows the Mask. */
export const HEAD_HEIGHT = 96;
export const SHEET_HEAD_HEIGHT = 64;

/** The head view's height on the desktop: the fixed height under Auto, else the Mask's pixel height at the percent, at most the column's (Q36). */
export const headHeight = (scale: MascotScale, maskHeight: number, columnHeight: number): number =>
  (scale === 'auto' ? HEAD_HEIGHT : Math.min((maskHeight * scale) / 100, columnHeight));

/** The Mascot's size on this device: Auto fits the chat's height; a number is a percent of the base's pixel size. */
export type MascotScale = 'auto' | number;
export const MASCOT_SCALE_MIN = 25;
export const MASCOT_SCALE_MAX = 150;

const MASCOT_SCALE_KEY = 'formamorph.formaquestion.mascotScale';

/** The Mascot scale this device stored. Auto when nothing is stored, it is damaged, or storage is blocked. */
export function readStoredMascotScale(): MascotScale {
  try {
    const stored = Number(localStorage.getItem(MASCOT_SCALE_KEY) || 'auto');
    return Number.isFinite(stored) ? clamp(stored, MASCOT_SCALE_MIN, MASCOT_SCALE_MAX) : 'auto';
  } catch {
    return 'auto';
  }
}

/** Stores the Mascot scale on this device. With storage blocked, it lasts for this visit only. */
export function writeStoredMascotScale(scale: MascotScale): void {
  try {
    localStorage.setItem(MASCOT_SCALE_KEY, String(scale));
  } catch { /* blocked storage */ }
}

const MASCOT_PLACEMENT_KEY = 'formamorph.formaquestion.mascotPlacement';
const MASCOT_PLACEMENTS: readonly string[] = ['beside', 'below', 'auto'] satisfies readonly MascotPlacement[];
export const isMascotPlacement = (value: unknown): value is MascotPlacement => typeof value === 'string' && MASCOT_PLACEMENTS.includes(value);

/** The Mascot placement this device stored. Auto when nothing is stored, it is damaged, or storage is blocked. */
export function readStoredMascotPlacement(): MascotPlacement {
  try {
    const stored = localStorage.getItem(MASCOT_PLACEMENT_KEY);
    return isMascotPlacement(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

/** Stores the Mascot placement on this device. With storage blocked, it lasts for this visit only. */
export function writeStoredMascotPlacement(placement: MascotPlacement): void {
  try {
    localStorage.setItem(MASCOT_PLACEMENT_KEY, placement);
  } catch { /* blocked storage */ }
}

const HEAD_VIEW_KEY = 'formamorph.formaquestion.mascotView';

/** Whether this device shows the Mascot's head alone on the desktop. False when nothing is stored or storage is blocked. */
export function readStoredHeadView(): boolean {
  try {
    return localStorage.getItem(HEAD_VIEW_KEY) === 'head';
  } catch {
    return false;
  }
}

/** Stores the desktop Mascot view on this device. With storage blocked, it lasts for this visit only. */
export function writeStoredHeadView(head: boolean): void {
  try {
    localStorage.setItem(HEAD_VIEW_KEY, head ? 'head' : 'full');
  } catch { /* blocked storage */ }
}
