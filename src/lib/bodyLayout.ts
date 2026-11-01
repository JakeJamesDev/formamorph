/**
 * Body Layout: one Slot Box per capacity unit on a Backdrop. Pure: box sync to entries, stacking order, snap lines
 * and clamps. Every position and size is a fraction of the Backdrop.
 */
import { entityImages } from '@/lib/entityImages';
import { clamp } from '@/lib/utils';
import type { Backdrop, Body, BodyEntry, GalleryImage, SlotBox } from '@/types';

/** The Backdrops a Body can pick without an image of its own. */
export type OutlineKind = Exclude<Backdrop['kind'], 'image'>;

/** A Slot Box's smallest width and height. */
export const MIN_BOX_SIZE = 0.04;
/** The widths / heights the bottom-edge drag can reach. */
export const MIN_ASPECT = 0.3;
export const MAX_ASPECT = 3;
/** One arrow key press. */
export const KEY_STEP = 0.01;
/** The most units an entry can hold. A box is drawn per unit, so this bounds what a world file can ask to draw. */
export const MAX_CAPACITY = 99;

const NEW_BOX_SIDE = 0.18;
const OUTLINE_ASPECT = { humanoid: 0.5, quadruped: 1.6 } as const;
const NEW_BODY_ASPECT = OUTLINE_ASPECT.humanoid;

export const clampAspect = (aspect: number): number => clamp(aspect, MIN_ASPECT, MAX_ASPECT);

/** A small square at the Backdrop's center: square on screen, so its fractions follow the aspect (Q5). */
export function centerBox(aspect: number): SlotBox {
  const w = aspect >= 1 ? NEW_BOX_SIDE / aspect : NEW_BOX_SIDE;
  const h = aspect >= 1 ? NEW_BOX_SIDE : NEW_BOX_SIDE * aspect;
  return { x: 0.5 - w / 2, y: 0.5 - h / 2, w, h };
}

/** A new Body: Humanoid, no slots (Q6). */
export const newBody = (id: string, name: string): Body => ({
  id, name, entries: [], backdrop: { kind: 'humanoid' }, aspect: NEW_BODY_ASPECT,
});

/** A new entry: one unit, one center box. */
export const newEntry = (slotId: string, aspect: number): BodyEntry => ({ slotId, boxes: [centerBox(aspect)] });

/** The entry's other fields with a capacity and its boxes. Capacity 1 is stored as absent. */
const entryOf = <E extends { slotId: string }>(rest: E, capacity: number, boxes: SlotBox[]): E & BodyEntry =>
  (capacity === 1 ? { ...rest, boxes } : { ...rest, capacity, boxes });

/** The entry at a new capacity: raising adds center boxes, lowering drops the last (Q5). */
export function withCapacity(entry: BodyEntry, capacity: number, aspect: number): BodyEntry {
  const { capacity: _drop, ...rest } = entry;
  return entryOf(rest, capacity, Array.from({ length: capacity }, (_, unit) => entry.boxes[unit] ?? centerBox(aspect)));
}

/** The Body on a new Backdrop. An outline sets its own aspect and Plain keeps the current one (Q53). */
export function withOutline(body: Body, kind: OutlineKind): Body {
  return { ...body, backdrop: { kind }, aspect: kind === 'plain' ? body.aspect : OUTLINE_ASPECT[kind] };
}

/** The Body on a Custom Image. A new file keeps the image's other fields; `aspect` is the clamped aspect of the file (Q15). */
export function withBackdropImage(body: Body, data: string, aspect: number = body.aspect): Body {
  const had = body.backdrop.kind === 'image' ? body.backdrop.image : {};
  const opacity = body.backdrop.kind === 'image' ? body.backdrop.opacity : undefined;
  return { ...body, backdrop: { kind: 'image', image: { ...had, data }, ...(opacity === undefined ? {} : { opacity }) }, aspect: clampAspect(aspect) };
}

/** The Body with its Custom Image faded to `opacity` (0 to 1, clamped). Any other Backdrop stays as it is. */
export function withBackdropOpacity(body: Body, opacity: number): Body {
  return body.backdrop.kind === 'image' ? { ...body, backdrop: { ...body.backdrop, opacity: clamp(opacity, 0, 1) } } : body;
}

/** The label of one box in the editor: "Hand 1", or "Head" at capacity 1 (Q19). */
export const boxLabel = (slotName: string, capacity: number, unit: number): string =>
  (capacity > 1 ? `${slotName} ${unit + 1}` : slotName);

/** One Slot Box of a Body. */
export interface BoxRef {
  slotId: string;
  unit: number;
}

export const boxKey = ({ slotId, unit }: BoxRef): string => `${slotId}-${unit}`;

export const sameBox = (a: BoxRef | null, b: BoxRef | null): boolean =>
  a?.slotId === b?.slotId && a?.unit === b?.unit;

const flatBoxes = (entries: readonly BodyEntry[]): (BoxRef & { box: SlotBox })[] =>
  entries.flatMap((entry) => entry.boxes.map((box, unit) => ({ slotId: entry.slotId, unit, box })));

/** The box the ref names, if the Body still has it. */
export const boxAt = (entries: readonly BodyEntry[], { slotId, unit }: BoxRef): SlotBox | undefined =>
  entries.find((entry) => entry.slotId === slotId)?.boxes[unit];

/** The entries with one box replaced. */
export const withBox = (entries: readonly BodyEntry[], { slotId, unit }: BoxRef, box: SlotBox): BodyEntry[] =>
  entries.map((entry) => (entry.slotId === slotId
    ? { ...entry, boxes: entry.boxes.map((had, index) => (index === unit ? box : had)) }
    : entry));

/** Each box's z-index by {@link boxKey}: a smaller area draws above. Equal areas follow entry, then unit order (Q47). */
export function stackOrder(entries: readonly BodyEntry[]): Map<string, number> {
  const areas = flatBoxes(entries).map((ref) => ({ key: boxKey(ref), area: ref.box.w * ref.box.h }));
  const sorted = [...areas].sort((a, b) => b.area - a.area);
  return new Map(sorted.map(({ key }, index) => [key, index + 1]));
}

/** A box's place on its Backdrop, as CSS. */
export const boxStyle = (box: SlotBox, zIndex: number | undefined) => ({
  left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, zIndex,
});

/** What each box holds, by {@link boxKey}: a slot's occupants fill its boxes in the order given (Q20, Q21). */
export function fillBoxes<T>(entries: readonly BodyEntry[], occupantsOf: (slotId: string) => readonly T[]): Map<string, T> {
  return new Map(entries.flatMap((entry) => {
    const occupants = occupantsOf(entry.slotId);
    return entry.boxes.slice(0, occupants.length).map((_, unit) => [boxKey({ slotId: entry.slotId, unit }), occupants[unit]] as const);
  }));
}

/** An image's frame inside its box at the image's own aspect, as fractions of the box (Q7). `aspect` is the Backdrop's. */
export function frameInBox(box: SlotBox, aspect: number, imageAspect: number): { w: number; h: number } {
  const boxAspect = (box.w * aspect) / box.h;
  return imageAspect >= boxAspect ? { w: 1, h: boxAspect / imageAspect } : { w: imageAspect / boxAspect, h: 1 };
}

/** The box moved by a delta, kept inside the Backdrop. */
export const movedBox = (box: SlotBox, dx: number, dy: number): SlotBox => ({
  ...box, x: clamp(box.x + dx, 0, 1 - box.w), y: clamp(box.y + dy, 0, 1 - box.h),
});

/** The box grown from its bottom-right corner by a delta, inside the Backdrop and at least the smallest size. */
export const grownBox = (box: SlotBox, dw: number, dh: number): SlotBox => ({
  ...box, w: clamp(box.w + dw, MIN_BOX_SIZE, 1 - box.x), h: clamp(box.h + dh, MIN_BOX_SIZE, 1 - box.y),
});

/** A box any stored shape can draw: finite, inside the Backdrop and at least the smallest size. */
export function clampedBox(box: SlotBox): SlotBox {
  const w = clamp(box.w, MIN_BOX_SIZE, 1);
  const h = clamp(box.h, MIN_BOX_SIZE, 1);
  return { x: clamp(box.x, 0, 1 - w), y: clamp(box.y, 0, 1 - h), w, h };
}

export type BoxCorner = 'nw' | 'ne' | 'sw' | 'se';

/** Where a drag's snap lines sit, as fractions. A vertical line has an x, a horizontal line a y. */
export interface SnapLines {
  x: readonly number[];
  y: readonly number[];
}

/** The lines a dragged box snaps to: every other box's edges and centers, and the Backdrop's vertical midline (Q17). */
export function snapLines(entries: readonly BodyEntry[], skip: BoxRef): SnapLines {
  const others = flatBoxes(entries).filter((ref) => !sameBox(ref, skip)).map((ref) => ref.box);
  return {
    x: [...others.flatMap((b) => [b.x, b.x + b.w / 2, b.x + b.w]), 0.5],
    y: others.flatMap((b) => [b.y, b.y + b.h / 2, b.y + b.h]),
  };
}

/** The closest line within reach of any edge: the shift to reach it, and the line. */
function nearestLine(edges: readonly number[], lines: readonly number[], reach: number): { shift: number; line: number } | null {
  let best: { shift: number; line: number } | null = null;
  for (const edge of edges) {
    for (const line of lines) {
      const shift = line - edge;
      if (Math.abs(shift) <= reach && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, line };
    }
  }
  return best;
}

/** One drag step's result, and the lines it snapped to, for the guides. */
export interface SnappedBox {
  box: SlotBox;
  guideX?: number;
  guideY?: number;
}

/** How far a snap reaches, as fractions of the Backdrop's width and height. */
export interface SnapReach {
  lines: SnapLines;
  reachX: number;
  reachY: number;
}

/** The start box moved by the drag's delta, then snapped by its edges and center when `snap` is given. */
export function dragMove(start: SlotBox, dx: number, dy: number, snap: SnapReach | null): SnappedBox {
  const moved = movedBox(start, dx, dy);
  if (!snap) return { box: moved };
  const sx = nearestLine([moved.x, moved.x + moved.w / 2, moved.x + moved.w], snap.lines.x, snap.reachX);
  const sy = nearestLine([moved.y, moved.y + moved.h / 2, moved.y + moved.h], snap.lines.y, snap.reachY);
  return {
    box: movedBox(moved, sx?.shift ?? 0, sy?.shift ?? 0),
    guideX: sx?.line,
    guideY: sy?.line,
  };
}

/** The start box resized by the drag's delta from one corner, then snapped by that corner when `snap` is given. */
export function dragResize(start: SlotBox, corner: BoxCorner, dx: number, dy: number, snap: SnapReach | null): SnappedBox {
  const west = corner.includes('w');
  const north = corner.includes('n');
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const nextX = (shift: number) => (west ? clamp(start.x + shift, 0, right - MIN_BOX_SIZE) : clamp(right + shift, start.x + MIN_BOX_SIZE, 1));
  const nextY = (shift: number) => (north ? clamp(start.y + shift, 0, bottom - MIN_BOX_SIZE) : clamp(bottom + shift, start.y + MIN_BOX_SIZE, 1));
  const clampedX = nextX(dx);
  const clampedY = nextY(dy);
  const sx = snap && nearestLine([clampedX], snap.lines.x, snap.reachX);
  const sy = snap && nearestLine([clampedY], snap.lines.y, snap.reachY);
  const edgeX = nextX(clampedX - (west ? start.x : right) + (sx?.shift ?? 0));
  const edgeY = nextY(clampedY - (north ? start.y : bottom) + (sy?.shift ?? 0));
  return {
    box: {
      x: west ? edgeX : start.x,
      y: north ? edgeY : start.y,
      w: west ? right - edgeX : edgeX - start.x,
      h: north ? bottom - edgeY : edgeY - start.y,
    },
    guideX: sx?.line,
    guideY: sy?.line,
  };
}

/** The next box a click on an entry's row selects: its first unit, then each next one, wrapping (Q52). */
export const rowSelection = (selected: BoxRef | null, slotId: string, capacity: number): BoxRef =>
  (selected?.slotId === slotId ? { slotId, unit: (selected.unit + 1) % capacity } : { slotId, unit: 0 });

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

/** A stored Backdrop, or the new-Body default for an absent or unknown one. */
export function parseBackdrop(raw: unknown): Backdrop {
  if (isRecord(raw)) {
    if (raw.kind === 'humanoid' || raw.kind === 'quadruped' || raw.kind === 'plain') return { kind: raw.kind };
    if (raw.kind === 'image' && isRecord(raw.image)) {
      // entityImages checks the stored shape; the cast only satisfies its input type.
      const [image] = entityImages({ images: [raw.image as unknown as GalleryImage] });
      if (image) return { kind: 'image', image, ...(isNumber(raw.opacity) ? { opacity: clamp(raw.opacity, 0, 1) } : {}) };
    }
  }
  return { kind: 'humanoid' };
}

/** A stored aspect in range, or the new-Body default. */
export const parseAspect = (raw: unknown): number => (isNumber(raw) && raw > 0 ? clampAspect(raw) : NEW_BODY_ASPECT);

const parseBox = (raw: unknown, aspect: number): SlotBox => (
  isRecord(raw) && isNumber(raw.x) && isNumber(raw.y) && isNumber(raw.w) && isNumber(raw.h)
    ? clampedBox({ x: raw.x, y: raw.y, w: raw.w, h: raw.h })
    : centerBox(aspect)
);

/** A stored entry with one drawable box per capacity unit. Each absent box gets the new-box default. */
export function parseEntryLayout(entry: Record<string, unknown> & { slotId: string }, aspect: number): BodyEntry {
  const { capacity: rawCapacity, boxes: rawBoxes, ...rest } = entry;
  const capacity = isNumber(rawCapacity) && rawCapacity >= 0 ? Math.min(Math.floor(rawCapacity), MAX_CAPACITY) : 1;
  const stored: unknown[] = Array.isArray(rawBoxes) ? rawBoxes : [];
  return entryOf(rest, capacity, Array.from({ length: capacity }, (_, unit) => parseBox(stored[unit], aspect)));
}
