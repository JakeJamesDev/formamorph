/** The Bubble chrome's layout: the Mascot, the answer bubble that speaks for her, and the column under it, in CSS pixels. */
import type { MascotMask } from './mascot';
import type { MascotSize } from './mascotMask';
import {
  CORNER_CLEARANCE, HEAD_HEIGHT, MASCOT_SCALE_MAX, MASCOT_SCALE_MIN, NARROW_WIDTH, READER_GAP, READER_WIDTH, SCREEN_MARGIN, TAB_CLEARANCE,
  type BubblePoint, type MascotScale, type MascotSide, type Viewport, type WindowBox, type WindowSize,
} from './windowBox';

/** The default rig's base size. It lays her out until her own base loads, so the window works without it. */
export const FALLBACK_BASE: MascotSize = { width: 888, height: 1184 };

/** Her height under Auto, as a share of the screen height (Q17). A tuning value. */
export const BUBBLE_AUTO_SHARE = 0.6;
/** The chat width until the bubble grip sets one, and the narrowest the grip goes. Apart from her size (Q19). */
const BUBBLE_DEFAULT_WIDTH = NARROW_WIDTH;
const BUBBLE_MIN_WIDTH = 320;
/** The shortest bubble. A tuning value. */
export const BUBBLE_MIN_HEIGHT = 48;
/** The space between the stacked pieces. */
export const BUBBLE_GAP = 8;
/** The space the tail crosses between the bubble and her. */
export const TAIL_LENGTH = 14;
/** The tail's distance from a bubble corner, so it leaves a straight edge. */
const TAIL_INSET = 20;
/** The strip's height: one row of small buttons. */
export const STRIP_HEIGHT = 32;
/** The pill's height, which the head view's row never goes under. */
const PILL_HEIGHT = 36;
/** The head view's largest head, as a share of the screen height. */
const HEAD_CAP_SHARE = 0.3;

/** The measured heights the layout stacks: the answer's content with padding, the question pill, and the ask input. */
export interface BubbleHeights {
  readonly content: number;
  readonly question: number;
  readonly input: number;
}

export interface BubbleInput {
  /** Her stored place, or null for the default at the bottom right. */
  readonly at: BubblePoint | null;
  /** The base's natural size and the Mask cut to it. */
  readonly base: MascotSize;
  readonly mask: MascotMask;
  readonly scale: MascotScale;
  readonly viewport: Viewport;
  readonly headView: boolean;
  readonly heights: BubbleHeights;
  /** The chat width the bubble grip set, or null for the default. */
  readonly width: number | null;
  /** The chat room's height the grip set, or null to fit the answer. A set room holds for any answer, as the Minimal box does. */
  readonly height: number | null;
  /** No exchange yet: no bubble, strip or question draws (Q13). */
  readonly empty: boolean;
  readonly showReader: boolean;
}

/** The corner a resize grip sits on. */
export type GripCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface BubbleTail {
  /** Where the tail leaves the bubble's edge. */
  readonly x: number;
  readonly y: number;
  readonly points: 'left' | 'right' | 'down';
}

export interface BubbleLayout {
  /** Her place on the screen: what a move stores. */
  readonly at: BubblePoint;
  /** The side of the screen she stands on. The column stands on the other side of her. */
  readonly side: MascotSide;
  /** Her whole body, or her head in head view. */
  readonly her: WindowBox;
  /** The head view's row of the head and the pill; null in full view, where the pill sits over her head. */
  readonly pillRow: WindowBox | null;
  /** The chat's room: the bubble grip's box, which the Backdrop fills. The bubble sits at its bottom. */
  readonly chat: WindowBox;
  readonly bubble: WindowBox;
  readonly tail: BubbleTail;
  readonly strip: WindowBox;
  readonly question: WindowBox;
  readonly input: WindowBox;
  /** The chat room's corner of the chat grip, which faces the most open space (Q7). */
  readonly grip: GripCorner;
  /** The corner of her top on the bubble's side, where her own grip sits. */
  readonly mascotGrip: GripCorner;
  /** The answer is taller than the bubble, so the bubble scrolls. */
  readonly scrolls: boolean;
  readonly reader: WindowBox | null;
  /** The box every piece fits in. */
  readonly group: WindowBox;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const bottomOf = (box: WindowBox): number => box.y + box.h;

/** Her whole height at a scale: Auto is a share of the screen; a percent is of the base's pixel height. */
const bodyHeightAt = (scale: MascotScale, base: MascotSize, viewport: Viewport): number =>
  (scale === 'auto' ? viewport.height * BUBBLE_AUTO_SHARE : (base.height * scale) / 100);

/** The head view's head height: the fixed height under Auto, else the Mask's pixel height at the percent. */
const headHeightAt = (scale: MascotScale, mask: MascotMask, viewport: Viewport): number =>
  (scale === 'auto' ? HEAD_HEIGHT : Math.min((mask.height * scale) / 100, viewport.height * HEAD_CAP_SHARE));

/** The chat width the player set, else the default, inside the room. */
const bubbleWidthFor = (width: number | null, room: number): number => Math.min(Math.max(width ?? BUBBLE_DEFAULT_WIDTH, BUBBLE_MIN_WIDTH), room);

/** The side of the screen a point stands on. */
const sideOf = (x: number, viewport: Viewport): MascotSide => (x > viewport.width / 2 ? 'right' : 'left');

/**
 * The pieces for her place. In full view the bubble's bottom sits at her head's bottom and grows up to the
 * screen margin; its tail leaves the edge nearest her at her head's center. The strip hangs under the
 * bubble, and the question and the input stand level with her feet (Q3). In head view one column stacks
 * the bubble, the head row, the strip, the question and the input (Q4). The column stands on the side of
 * her away from the nearer screen edge (Q6), and the grip takes the bubble corner with the most open
 * space beyond the group (Q7). All stay whole on the screen.
 */
export function bubbleLayout(input: BubbleInput): BubbleLayout {
  return input.headView ? headLayout(input) : fullLayout(input);
}

function fullLayout({ at, base, mask, scale, viewport, heights, width, height, empty, showReader }: BubbleInput): BubbleLayout {
  const { width: vw, height: vh } = viewport;
  const aspect = base.width / base.height;
  const centerShare = (mask.y + mask.height / 2) / base.height;
  const bottomShare = (mask.y + mask.height) / base.height;
  const below = stackBelow(heights, empty);
  // Her height fits the margins with the smallest bubble above her: it reaches past her head's center, and it is never under the minimum (Q17).
  const roomH = vh - SCREEN_MARGIN * 2;
  let bodyH = Math.min(
    bodyHeightAt(scale, base, viewport),
    roomH,
    (roomH - TAIL_INSET) / Math.max(1e-6, 1 - centerShare),
    (roomH - BUBBLE_MIN_HEIGHT) / Math.max(1e-6, 1 - bottomShare),
  );
  const roomW = vw - SCREEN_MARGIN * 2;
  let herW = bodyH * aspect;
  const w = bubbleWidthFor(width, Math.max(BUBBLE_MIN_WIDTH, roomW - herW - TAIL_LENGTH));
  if (herW + TAIL_LENGTH + w > roomW) {
    herW = Math.max(0, roomW - TAIL_LENGTH - w);
    bodyH = herW / aspect;
  }
  const headCenter = bodyH * centerShare;
  // The bubble rises off her head's bottom only when the strip would meet the question.
  const bubbleBottomOff = Math.min(bodyH * bottomShare, bodyH - below);
  const minH = Math.max(BUBBLE_MIN_HEIGHT, bubbleBottomOff - headCenter + TAIL_INSET);

  const wanted = at ?? { x: vw - TAB_CLEARANCE - herW / 2, y: vh - CORNER_CLEARANCE };
  const side = sideOf(wanted.x, viewport);
  const herX = side === 'right'
    ? clamp(wanted.x - herW / 2, SCREEN_MARGIN + w + TAIL_LENGTH, vw - SCREEN_MARGIN - herW)
    : clamp(wanted.x - herW / 2, SCREEN_MARGIN, vw - SCREEN_MARGIN - herW - TAIL_LENGTH - w);
  const bottom = clamp(wanted.y, Math.max(bodyH + SCREEN_MARGIN, SCREEN_MARGIN + minH + bodyH - bubbleBottomOff), vh - SCREEN_MARGIN);
  const her = { x: herX, y: bottom - bodyH, w: herW, h: bodyH };
  const columnX = side === 'right' ? herX - TAIL_LENGTH - w : herX + herW + TAIL_LENGTH;

  const bubbleBottom = her.y + bubbleBottomOff;
  const { chat, bubble } = chatAndBubble(columnX, bubbleBottom, w, minH, height, heights.content);
  const strip = { x: columnX, y: bubbleBottom + BUBBLE_GAP, w, h: empty ? 0 : STRIP_HEIGHT };
  const inputBox = { x: columnX, y: bottom - heights.input, w, h: heights.input };
  const question = { x: columnX, y: inputBox.y - BUBBLE_GAP - heights.question, w, h: empty ? 0 : heights.question };
  const tail: BubbleTail = {
    x: side === 'right' ? columnX + w : columnX,
    y: clamp(her.y + headCenter, bubble.y + TAIL_INSET, bubbleBottom - TAIL_INSET),
    points: side,
  };
  const scrolls = heights.content > bubble.h;
  return finish({ side, her, pillRow: null, chat, bubble, tail, strip, question, input: inputBox, scrolls, at: { x: herX + herW / 2, y: bottom } }, viewport, showReader);
}

function headLayout({ at, mask, scale, viewport, heights, width, height, empty, showReader }: BubbleInput): BubbleLayout {
  const { width: vw, height: vh } = viewport;
  const w = bubbleWidthFor(width, vw - SCREEN_MARGIN * 2);
  const headH = headHeightAt(scale, mask, viewport);
  const headW = Math.min((headH * mask.width) / mask.height, w);
  const rowH = Math.max(headH, PILL_HEIGHT);
  const under = rowH + BUBBLE_GAP + stackBelow(heights, empty) - STRIP_HEIGHT * Number(empty);

  const wanted = at ?? { x: vw - TAB_CLEARANCE - headW / 2, y: vh - CORNER_CLEARANCE };
  const side = sideOf(wanted.x, viewport);
  // The head sits at the row's end nearest the screen edge, so the column's outer edge is the head's.
  const columnX = clamp(side === 'right' ? wanted.x + headW / 2 - w : wanted.x - headW / 2, SCREEN_MARGIN, vw - SCREEN_MARGIN - w);
  const bottom = clamp(wanted.y, SCREEN_MARGIN + BUBBLE_MIN_HEIGHT + TAIL_LENGTH + under, vh - SCREEN_MARGIN);

  const inputBox = { x: columnX, y: bottom - heights.input, w, h: heights.input };
  const question = { x: columnX, y: inputBox.y - (empty ? 0 : BUBBLE_GAP + heights.question), w, h: empty ? 0 : heights.question };
  const strip = { x: columnX, y: question.y - (empty ? 0 : BUBBLE_GAP + STRIP_HEIGHT), w, h: empty ? 0 : STRIP_HEIGHT };
  const pillRow = { x: columnX, y: strip.y - BUBBLE_GAP - rowH, w, h: rowH };
  const her = { x: side === 'right' ? columnX + w - headW : columnX, y: bottomOf(pillRow) - headH, w: headW, h: headH };
  const bubbleBottom = pillRow.y - TAIL_LENGTH;
  const { chat, bubble } = chatAndBubble(columnX, bubbleBottom, w, BUBBLE_MIN_HEIGHT, height, heights.content);
  const tail: BubbleTail = { x: clamp(her.x + headW / 2, columnX + TAIL_INSET, columnX + w - TAIL_INSET), y: bubbleBottom, points: 'down' };
  const scrolls = heights.content > bubble.h;
  return finish({ side, her, pillRow, chat, bubble, tail, strip, question, input: inputBox, scrolls, at: { x: her.x + headW / 2, y: bottom } }, viewport, showReader);
}

/**
 * The chat's room over `bottom`, which the Backdrop fills, and the bubble inside it. The room is the set height,
 * or the answer's when none is set; the bubble fits its answer within the room and shares its bottom, as Minimal's bubbles do.
 */
function chatAndBubble(x: number, bottom: number, w: number, minH: number, height: number | null, content: number) {
  const roomH = clamp(height ?? content, minH, Math.max(minH, bottom - SCREEN_MARGIN));
  const bubbleH = clamp(content, minH, roomH);
  return { chat: { x, y: bottom - roomH, w, h: roomH }, bubble: { x, y: bottom - bubbleH, w, h: bubbleH } };
}

/** The height under the bubble's bottom that the strip, the question and the input take, with their gaps. */
const stackBelow = (heights: BubbleHeights, empty: boolean): number =>
  (empty ? 0 : BUBBLE_GAP + STRIP_HEIGHT + BUBBLE_GAP + heights.question) + BUBBLE_GAP + heights.input;

type Placed = Omit<BubbleLayout, 'grip' | 'mascotGrip' | 'reader' | 'group'>;

/** The grip corners, the reader on the wider free side at the bubble's height (Q11), and the box around them all. */
function finish(placed: Placed, viewport: Viewport, showReader: boolean): BubbleLayout {
  const { side, her, chat, input } = placed;
  const left = Math.min(her.x, chat.x);
  const right = Math.max(her.x + her.w, chat.x + chat.w);
  const top = Math.min(her.y, chat.y);
  const bottom = Math.max(bottomOf(her), bottomOf(input));
  const open = viewport.height - bottom > top ? 's' : 'n';
  const inner = side === 'right' ? 'w' : 'e';
  const grip: GripCorner = `${open}${inner}`;
  const mascotGrip: GripCorner = `n${inner}`;
  const freeLeft = left - SCREEN_MARGIN;
  const freeRight = viewport.width - SCREEN_MARGIN - right;
  const readerW = showReader ? Math.min(READER_WIDTH, Math.max(freeLeft, freeRight) - READER_GAP) : 0;
  const readerX = freeLeft > freeRight ? left - READER_GAP - readerW : right + READER_GAP;
  const reader = readerW > 0 ? { x: readerX, y: chat.y, w: readerW, h: bottomOf(input) - chat.y } : null;
  const groupLeft = reader ? Math.min(left, reader.x) : left;
  const groupRight = reader ? Math.max(right, reader.x + reader.w) : right;
  return { ...placed, grip, mascotGrip, reader, group: { x: groupLeft, y: top, w: groupRight - groupLeft, h: bottom - top } };
}

/** How far a drag of (dx, dy) moves a grip away from its box, across and down. */
const outwardOf = (grip: GripCorner, dx: number, dy: number) => ({
  across: grip.endsWith('w') ? -dx : dx,
  down: grip.startsWith('n') ? -dy : dy,
});

/**
 * Her scale and place after a drag of her grip by (dx, dy) from `start`. Her feet and her outer side stay put
 * (Q18), and her grip corner follows the pointer. The scale is a whole percent, which the device's Scale store keeps.
 */
export function resizeMascot(input: BubbleInput, start: BubbleLayout, dx: number, dy: number): { scale: number; at: BubblePoint } {
  const { across, down } = outwardOf(start.mascotGrip, dx, dy);
  // Her corner moves her width across and her height down, so each axis asks for a height; she takes their mean.
  // She grows from the size drawn now, her head in head view, so the first drag from Auto does not jump.
  const wanted = start.her.h + (across * (start.her.h / Math.max(1, start.her.w)) + down) / 2;
  const natural = input.headView ? input.mask.height : input.base.height;
  const scale = Math.round(clamp((wanted / natural) * 100, MASCOT_SCALE_MIN, MASCOT_SCALE_MAX));
  const grown = bubbleLayout({ ...input, scale, at: start.at });
  const outer = start.side === 'right' ? start.her.x + start.her.w : start.her.x;
  const x = start.side === 'right' ? outer - grown.her.w / 2 : outer + grown.her.w / 2;
  return { scale, at: bubbleLayout({ ...input, scale, at: { x, y: start.at.y } }).at };
}

/** The chat's room after a drag of the bubble grip by (dx, dy) from `start`. The room grows toward the grip's corner; she stays put. */
export function resizeChat(input: BubbleInput, start: BubbleLayout, dx: number, dy: number): WindowSize {
  const { across, down } = outwardOf(start.grip, dx, dy);
  const { chat } = bubbleLayout({ ...input, width: start.chat.w + across, height: start.chat.h + down, at: start.at });
  return { w: chat.w, h: chat.h };
}
