import { describe, expect, it } from 'vitest';
import {
  boxLabel, centerBox, clampedBox, dragMove, dragResize, fillBoxes, frameInBox, grownBox, MAX_CAPACITY, MIN_BOX_SIZE, movedBox, newBody, newEntry, parseEntryLayout,
  rowSelection, snapLines, stackOrder, withBackdropImage, withBox, withCapacity, withOutline, boxAt, MAX_ASPECT, MIN_ASPECT,
} from './bodyLayout';
import { parseBodies } from './bodies';
import type { BodyEntry, SlotBox } from '@/types';

const box = (x: number, y: number, w: number, h: number): SlotBox => ({ x, y, w, h });
const entry = (slotId: string, ...boxes: SlotBox[]): BodyEntry => (boxes.length > 1 ? { slotId, capacity: boxes.length, boxes } : { slotId, boxes });
const reach = (lines: { x: number[]; y: number[] }, within = 0.02) => ({ lines, reachX: within, reachY: within });

describe('new boxes', () => {
  it('centers a box that is square on screen at any aspect', () => {
    for (const aspect of [0.5, 1, 1.6, 3]) {
      const { x, y, w, h } = centerBox(aspect);
      expect(x + w / 2).toBeCloseTo(0.5);
      expect(y + h / 2).toBeCloseTo(0.5);
      expect(w * aspect).toBeCloseTo(h);
    }
  });

  it('starts a new Body on Humanoid with no slots', () => {
    expect(newBody('b', 'New Body')).toEqual({ id: 'b', name: 'New Body', entries: [], backdrop: { kind: 'humanoid' }, aspect: 0.5 });
  });

  it('gives a new entry one center box', () => {
    expect(newEntry('hand', 0.5).boxes).toEqual([centerBox(0.5)]);
  });
});

describe('withCapacity', () => {
  const placed = box(0.1, 0.1, 0.2, 0.2);

  it('adds a center box when capacity rises and keeps the placed ones', () => {
    const raised = withCapacity(entry('hand', placed), 3, 0.5);
    expect(raised.capacity).toBe(3);
    expect(raised.boxes).toEqual([placed, centerBox(0.5), centerBox(0.5)]);
  });

  it('drops the last box when capacity falls, and reads capacity 1 as absent', () => {
    const other = box(0.5, 0.5, 0.1, 0.1);
    const lowered = withCapacity(entry('hand', placed, other), 1, 0.5);
    expect(lowered.boxes).toEqual([placed]);
    expect(lowered).not.toHaveProperty('capacity');
  });
});

describe('withOutline', () => {
  const placed = { ...newBody('b', 'B'), aspect: 0.9, entries: [entry('hand', box(0.1, 0.2, 0.3, 0.4))] };

  it('sets the aspect of an outline and keeps box fractions', () => {
    expect(withOutline(placed, 'humanoid').aspect).toBe(0.5);
    const hound = withOutline(placed, 'quadruped');
    expect(hound.aspect).toBe(1.6);
    expect(hound.backdrop).toEqual({ kind: 'quadruped' });
    expect(hound.entries).toEqual(placed.entries);
  });

  it('keeps the current aspect on Plain', () => {
    expect(withOutline(placed, 'plain').aspect).toBe(0.9);
  });
});

describe('Custom Image Backdrop', () => {
  const placed = { ...newBody('b', 'B'), aspect: 0.9, entries: [entry('hand', box(0.1, 0.2, 0.3, 0.4))] };

  it('takes the image, its aspect and keeps the boxes', () => {
    const next = withBackdropImage(placed, 'data:a', 1.25);
    expect(next.backdrop).toEqual({ kind: 'image', image: { data: 'data:a' } });
    expect(next.aspect).toBe(1.25);
    expect(next.entries).toEqual(placed.entries);
  });

  it('clamps an aspect past the drag range, so the image gets bars rather than a stretch', () => {
    expect(withBackdropImage(placed, 'data:a', 9).aspect).toBe(MAX_ASPECT);
    expect(withBackdropImage(placed, 'data:a', 0.05).aspect).toBe(MIN_ASPECT);
  });

  it('keeps the aspect when no new one is given', () => {
    expect(withBackdropImage(placed, 'data:a').aspect).toBe(0.9);
  });

  it('leaves for an outline with the image gone and the boxes kept; Plain keeps the image aspect (Q72)', () => {
    const custom = withBackdropImage(placed, 'data:a', 1.25);
    expect(withOutline(custom, 'humanoid')).toMatchObject({ backdrop: { kind: 'humanoid' }, aspect: 0.5, entries: placed.entries });
    expect(withOutline(custom, 'quadruped').aspect).toBe(1.6);
    expect(withOutline(custom, 'plain')).toMatchObject({ backdrop: { kind: 'plain' }, aspect: 1.25, entries: placed.entries });
  });

  it('survives import and drops an image with no data', () => {
    const [kept] = parseBodies([{ id: 'x', name: 'X', backdrop: { kind: 'image', image: { data: 'data:a' } }, aspect: 1.25 }]);
    expect(kept.backdrop).toEqual({ kind: 'image', image: { data: 'data:a' } });
    for (const image of [{ data: '' }, {}, 'text', null]) {
      const [broken] = parseBodies([{ id: 'x', name: 'X', backdrop: { kind: 'image', image } }]);
      expect(broken.backdrop).toEqual({ kind: 'humanoid' });
    }
  });
});

describe('boxLabel', () => {
  it('numbers units only above capacity 1', () => {
    expect(boxLabel('Hand', 2, 0)).toBe('Hand 1');
    expect(boxLabel('Hand', 2, 1)).toBe('Hand 2');
    expect(boxLabel('Head', 1, 0)).toBe('Head');
  });
});

describe('stackOrder', () => {
  it('draws a smaller box above a larger one, whatever the entry order', () => {
    const order = stackOrder([entry('ring', box(0, 0, 0.1, 0.1)), entry('chest', box(0, 0, 0.5, 0.5))]);
    expect(order.get('ring-0')).toBeGreaterThan(order.get('chest-0') ?? Infinity);
  });

  it('breaks an equal area by entry order, then unit order', () => {
    const same = box(0, 0, 0.2, 0.2);
    const order = stackOrder([entry('hand', same, same), entry('ring', same)]);
    expect([order.get('hand-0'), order.get('hand-1'), order.get('ring-0')]).toEqual([1, 2, 3]);
  });
});

describe('fillBoxes', () => {
  const entries: BodyEntry[] = [
    { slotId: 'hand', capacity: 2, boxes: [box(0, 0, 0.1, 0.1), box(0.2, 0, 0.1, 0.1)] },
    { slotId: 'head', boxes: [box(0.4, 0, 0.1, 0.1)] },
  ];

  it('fills units in the order given, per slot', () => {
    const filled = fillBoxes(entries, (slotId) => (slotId === 'hand' ? ['a', 'b'] : ['a']));
    expect([...filled]).toEqual([['hand-0', 'a'], ['hand-1', 'b'], ['head-0', 'a']]);
  });

  it('leaves spare units empty and drops occupants past the last box', () => {
    expect([...fillBoxes(entries, (slotId) => (slotId === 'hand' ? ['a'] : []))]).toEqual([['hand-0', 'a']]);
    expect([...fillBoxes(entries, (slotId) => (slotId === 'head' ? ['a', 'b'] : []))]).toEqual([['head-0', 'a']]);
  });
});

describe('frameInBox', () => {
  it('fits a tall image to the height of a wider box', () => {
    const frame = frameInBox(box(0, 0, 0.5, 0.25), 1, 240 / 720);
    expect(frame.h).toBe(1);
    expect(frame.w).toBeCloseTo(1 / 6);
  });

  it('fits a wide image to the width of a taller box', () => {
    const frame = frameInBox(box(0, 0, 0.25, 0.5), 1, 2);
    expect(frame.w).toBe(1);
    expect(frame.h).toBeCloseTo(1 / 4);
  });

  it('reads the box on screen, through the Backdrop aspect', () => {
    expect(frameInBox(box(0, 0, 0.5, 0.25), 0.5, 1)).toEqual({ w: 1, h: 1 });
  });
});

describe('clamps', () => {
  it('keeps a moved box inside the Backdrop', () => {
    expect(movedBox(box(0.5, 0.5, 0.2, 0.2), 1, 1)).toEqual(box(0.8, 0.8, 0.2, 0.2));
    expect(movedBox(box(0.5, 0.5, 0.2, 0.2), -1, -1)).toEqual(box(0, 0, 0.2, 0.2));
  });

  it('keeps a grown box inside the Backdrop and at least the smallest size', () => {
    expect(grownBox(box(0.5, 0.5, 0.2, 0.2), 1, 1)).toEqual(box(0.5, 0.5, 0.5, 0.5));
    expect(grownBox(box(0.5, 0.5, 0.2, 0.2), -1, -1)).toEqual(box(0.5, 0.5, MIN_BOX_SIZE, MIN_BOX_SIZE));
  });

  it('pulls a stored box back inside the Backdrop', () => {
    expect(clampedBox(box(0.9, -1, 0.5, 2))).toEqual(box(0.5, 0, 0.5, 1));
  });
});

describe('snapLines', () => {
  const entries = [entry('hand', box(0.1, 0.2, 0.2, 0.4), box(0.6, 0.5, 0.2, 0.1))];

  it('holds every other box\'s edges and centers, and the vertical midline', () => {
    const lines = snapLines(entries, { slotId: 'hand', unit: 1 });
    expect(lines.x).toEqual([0.1, 0.2, expect.closeTo(0.3), 0.5]);
    expect(lines.y).toEqual([0.2, expect.closeTo(0.4), expect.closeTo(0.6)]);
  });

  it('never offers a horizontal midline', () => {
    expect(snapLines([], { slotId: 'hand', unit: 0 })).toEqual({ x: [0.5], y: [] });
  });
});

describe('dragMove', () => {
  const start = box(0.1, 0.1, 0.2, 0.2);

  it('moves freely with no snap', () => {
    expect(dragMove(start, 0.05, 0.05, null)).toEqual({ box: { ...start, x: expect.closeTo(0.15), y: expect.closeTo(0.15) } });
  });

  it('snaps a left edge, a center or a right edge to a line within reach', () => {
    const lines = { x: [0.5], y: [] };
    expect(dragMove(start, 0.39, 0, reach(lines)).box.x).toBeCloseTo(0.5);
    expect(dragMove(start, 0.29, 0, reach(lines)).box.x).toBeCloseTo(0.4);
    expect(dragMove(start, 0.19, 0, reach(lines)).box.x).toBeCloseTo(0.3);
    expect(dragMove(start, 0.39, 0, reach(lines)).guideX).toBe(0.5);
  });

  it('leaves a box alone beyond reach', () => {
    const snapped = dragMove(start, 0.3, 0, reach({ x: [0.9], y: [] }));
    expect(snapped.box.x).toBeCloseTo(0.4);
    expect(snapped.guideX).toBeUndefined();
  });

  it('takes the closest line of two in reach', () => {
    expect(dragMove(start, 0.39, 0, reach({ x: [0.484, 0.495], y: [] })).box.x).toBeCloseTo(0.495);
    expect(dragMove(start, 0.39, 0, reach({ x: [0.495, 0.484], y: [] })).box.x).toBeCloseTo(0.495);
  });

  it('never snaps a box out of the Backdrop', () => {
    expect(dragMove(start, 0.8, 0, reach({ x: [1.01], y: [] })).box.x).toBeCloseTo(0.8);
  });
});

describe('dragResize', () => {
  const start = box(0.2, 0.2, 0.4, 0.4);

  it('moves only the dragged corner', () => {
    const se = dragResize(start, 'se', 0.1, 0.1, null).box;
    expect(se.x).toBe(0.2);
    expect(se.w).toBeCloseTo(0.5);
    const nw = dragResize(start, 'nw', 0.1, 0.1, null).box;
    expect(nw.x).toBeCloseTo(0.3);
    expect(nw.w).toBeCloseTo(0.3);
    expect(nw.x + nw.w).toBeCloseTo(0.6);
  });

  it('stops at the smallest size, without moving the far edge', () => {
    const { x, w, y, h } = dragResize(start, 'nw', 1, 1, null).box;
    expect(w).toBeCloseTo(MIN_BOX_SIZE);
    expect(h).toBeCloseTo(MIN_BOX_SIZE);
    expect(x + w).toBeCloseTo(0.6);
    expect(y + h).toBeCloseTo(0.6);
  });

  it('stops at the Backdrop', () => {
    expect(dragResize(start, 'se', 1, 1, null).box).toEqual(box(0.2, 0.2, 0.8, 0.8));
    expect(dragResize(start, 'nw', -1, -1, null).box).toEqual(box(0, 0, expect.closeTo(0.6), expect.closeTo(0.6)));
  });

  it('snaps a corner held at the Backdrop edge back to a line within reach', () => {
    const snapped = dragResize(start, 'se', 1, 0, reach({ x: [0.99], y: [] }));
    expect(snapped.box.x + snapped.box.w).toBeCloseTo(0.99);
  });

  it('snaps the dragged corner to a line within reach', () => {
    const snapped = dragResize(start, 'se', 0.09, 0, reach({ x: [0.7], y: [] }));
    expect(snapped.box.x + snapped.box.w).toBeCloseTo(0.7);
    expect(snapped.guideX).toBe(0.7);
  });
});

describe('rowSelection', () => {
  it('selects the first unit, then each next one, and wraps', () => {
    const first = rowSelection(null, 'hand', 2);
    expect(first).toEqual({ slotId: 'hand', unit: 0 });
    const second = rowSelection(first, 'hand', 2);
    expect(second).toEqual({ slotId: 'hand', unit: 1 });
    expect(rowSelection(second, 'hand', 2)).toEqual({ slotId: 'hand', unit: 0 });
  });

  it('starts over on another row', () => {
    expect(rowSelection({ slotId: 'hand', unit: 1 }, 'ring', 2)).toEqual({ slotId: 'ring', unit: 0 });
  });
});

describe('withBox', () => {
  it('replaces only the named box', () => {
    const next = box(0.4, 0.4, 0.1, 0.1);
    const was = [entry('hand', box(0, 0, 0.1, 0.1), box(0.2, 0, 0.1, 0.1)), entry('ring', box(0, 0.5, 0.1, 0.1))];
    const entries = withBox(was, { slotId: 'hand', unit: 1 }, next);
    expect(boxAt(entries, { slotId: 'hand', unit: 1 })).toEqual(next);
    expect(boxAt(entries, { slotId: 'hand', unit: 0 })).toEqual(was[0].boxes[0]);
    expect(entries[1]).toEqual(was[1]);
  });
});

describe('parseBodies layout', () => {
  it('fills an absent Backdrop, aspect and box with the new-Body defaults', () => {
    expect(parseBodies([{ id: 'b', name: 'B', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'ring' }] }])).toEqual([{
      id: 'b', name: 'B', backdrop: { kind: 'humanoid' }, aspect: 0.5,
      entries: [{ slotId: 'hand', capacity: 2, boxes: [centerBox(0.5), centerBox(0.5)] }, { slotId: 'ring', boxes: [centerBox(0.5)] }],
    }]);
  });

  it('keeps a stored layout', () => {
    const stored = {
      id: 'b', name: 'B', backdrop: { kind: 'quadruped' }, aspect: 1.6,
      entries: [{ slotId: 'neck', boxes: [box(0.6, 0.2, 0.1, 0.2)] }],
    };
    expect(parseBodies([stored])).toEqual([stored]);
  });

  it('keeps an image Backdrop', () => {
    const backdrop = { kind: 'image', image: { data: 'x' } };
    expect(parseBodies([{ id: 'b', entries: [], backdrop, aspect: 1 }])[0].backdrop).toEqual(backdrop);
  });

  it('replaces an unknown Backdrop, a bad aspect and a bad box', () => {
    const [body] = parseBodies([{ id: 'b', entries: [{ slotId: 'hand', boxes: [{ x: 'no' }] }], backdrop: { kind: 'dragon' }, aspect: -1 }]);
    expect(body.backdrop).toEqual({ kind: 'humanoid' });
    expect(body.aspect).toBe(0.5);
    expect(body.entries[0].boxes).toEqual([centerBox(0.5)]);
  });

  it('trims extra boxes to the capacity, and bounds what a file can ask to draw', () => {
    expect(parseEntryLayout({ slotId: 'hand', boxes: [box(0, 0, 0.1, 0.1), box(0.5, 0, 0.1, 0.1)] }, 0.5).boxes).toHaveLength(1);
    expect(parseEntryLayout({ slotId: 'hand', capacity: 1e9 }, 0.5).boxes).toHaveLength(MAX_CAPACITY);
    expect(parseEntryLayout({ slotId: 'hand', capacity: 0 }, 0.5)).toEqual({ slotId: 'hand', capacity: 0, boxes: [] });
    expect(parseEntryLayout({ slotId: 'hand', capacity: -1 }, 0.5).boxes).toHaveLength(1);
  });
});
