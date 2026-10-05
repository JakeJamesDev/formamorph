import { describe, expect, it } from 'vitest';
import {
  bubbleLayout, resizeChat, resizeMascot, BUBBLE_AUTO_SHARE, BUBBLE_GAP, BUBBLE_MIN_HEIGHT, type BubbleInput, type BubbleLayout,
} from './bubbleLayout';
import { HEAD_HEIGHT, MASCOT_SCALE_MAX, MASCOT_SCALE_MIN, SCREEN_MARGIN, type WindowBox } from './windowBox';

const SCREEN = { width: 1600, height: 900 };
// Her head is the top third of a 300 × 600 base: its center sits at a sixth of her height.
const BASE = { width: 300, height: 600 };
const MASK = { x: 50, y: 0, width: 200, height: 200 };

const input = (change: Partial<BubbleInput> = {}): BubbleInput => ({
  at: { x: 1300, y: 850 },
  base: BASE,
  mask: MASK,
  scale: 100,
  viewport: SCREEN,
  headView: false,
  heights: { content: 100, question: 32, input: 44 },
  empty: false,
  showReader: false,
  width: null,
  height: null,
  ...change,
});

const bottomOf = (box: WindowBox) => box.y + box.h;
const rightOf = (box: WindowBox) => box.x + box.w;
const M = SCREEN_MARGIN;
const whole = (box: WindowBox) => box.x >= M && box.y >= M && rightOf(box) <= SCREEN.width - M && bottomOf(box) <= SCREEN.height - M;

describe('the bubble layout in full view', () => {
  it('sets the bubble bottom at the bottom of her head', () => {
    const layout = bubbleLayout(input());
    expect(bottomOf(layout.bubble)).toBe(layout.her.y + 200);
  });

  it('keeps a one-line answer tall enough to reach the tail at her mouth', () => {
    const layout = bubbleLayout(input({ heights: { content: 20, question: 32, input: 44 } }));
    expect(layout.bubble.y).toBeLessThan(layout.tail.y);
    expect(layout.tail.y).toBe(layout.her.y + 140);
  });

  it('leaves the tail from the edge nearest her at her mouth, on the lower half of her head', () => {
    const layout = bubbleLayout(input());
    expect(layout.tail).toEqual({ x: rightOf(layout.bubble), y: layout.her.y + 140, points: 'right' });
    expect(rightOf(layout.bubble)).toBeLessThan(layout.her.x);
  });

  it('grows a long answer up to the screen margin and keeps the strip under it', () => {
    const layout = bubbleLayout(input({ heights: { content: 5000, question: 32, input: 44 } }));
    expect(layout.bubble.y).toBe(SCREEN_MARGIN);
    expect(bottomOf(layout.bubble)).toBe(layout.her.y + 200);
    expect(layout.strip.y).toBe(bottomOf(layout.bubble) + BUBBLE_GAP);
  });

  it('keeps a short answer at its own height, with a gap between the strip and the question', () => {
    const layout = bubbleLayout(input({ heights: { content: 160, question: 32, input: 44 } }));
    expect(layout.bubble.h).toBe(160);
    expect(layout.question.y - bottomOf(layout.strip)).toBeGreaterThan(BUBBLE_GAP);
  });

  it('sets the question and the input level with her feet, the input last', () => {
    const layout = bubbleLayout(input());
    expect(bottomOf(layout.input)).toBe(bottomOf(layout.her));
    expect(bottomOf(layout.question)).toBe(layout.input.y - BUBBLE_GAP);
    expect(layout.input.x).toBe(layout.bubble.x);
    expect(layout.question.w).toBe(layout.bubble.w);
  });

  it('keeps the input at her feet with no exchange', () => {
    const layout = bubbleLayout(input({ empty: true }));
    expect(bottomOf(layout.input)).toBe(bottomOf(layout.her));
  });

  it('shows the chat room before the first answer: the set height, else the default share of the screen', () => {
    const full = bubbleLayout(input({ empty: true, heights: { content: 0, question: 0, input: 44 } }));
    expect(full.chat.h).toBe(Math.min(SCREEN.height * 0.6, bottomOf(full.chat) - M));
    expect(full.chat.h).toBeGreaterThan(BUBBLE_MIN_HEIGHT);
    expect(bubbleLayout(input({ empty: true, height: 200, heights: { content: 0, question: 0, input: 44 } })).chat.h).toBe(200);
    expect(bubbleLayout(input({ empty: true, headView: true, scale: 'auto', heights: { content: 0, question: 0, input: 44 } })).chat.h).toBe(SCREEN.height * 0.6);
  });

  it('mirrors the group when she crosses the center of the screen', () => {
    const right = bubbleLayout(input({ at: { x: 900, y: 850 } }));
    const left = bubbleLayout(input({ at: { x: 700, y: 850 } }));
    expect(right.side).toBe('right');
    expect(rightOf(right.bubble)).toBeLessThan(right.her.x);
    expect(left.side).toBe('left');
    expect(left.bubble.x).toBeGreaterThan(rightOf(left.her));
    expect(left.tail).toMatchObject({ x: left.bubble.x, points: 'left' });
  });

  it('sets the chat grip on the chat corner that faces the most free screen beyond the group, her side included', () => {
    // A group at the top left faces free screen below it and to its right, so the grip sits on the chat corner nearest her.
    const topLeft = bubbleLayout(input({ scale: 50, at: { x: 300, y: 350 } }));
    expect(topLeft.side).toBe('left');
    expect(topLeft.grip).toBe('se');
    const headRight = bubbleLayout(input({ headView: true, scale: 'auto', at: { x: 1500, y: 850 } }));
    expect(headRight.grip).toBe('nw');
  });

  it('sets the grip on the bubble corner away from the nearest edges', () => {
    expect(bubbleLayout(input()).grip).toBe('nw');
    expect(bubbleLayout(input({ at: { x: 300, y: 850 } })).grip).toBe('ne');
    // A bubble that reaches the top has its open space under it.
    expect(bubbleLayout(input({ heights: { content: 5000, question: 32, input: 44 } })).grip).toBe('sw');
  });

  it('keeps the whole group inside the screen margins when she is placed past an edge', () => {
    for (const at of [{ x: 5000, y: 5000 }, { x: -5000, y: 5000 }, { x: 5000, y: -5000 }]) {
      const layout = bubbleLayout(input({ at }));
      for (const box of [layout.her, layout.bubble, layout.strip, layout.question, layout.input]) expect(whole(box)).toBe(true);
      expect(layout.at.y).toBe(bottomOf(layout.her));
    }
  });

  it('keeps the head view column inside the screen margins', () => {
    for (const at of [{ x: 5000, y: 5000 }, { x: -5000, y: 5000 }]) {
      const layout = bubbleLayout(input({ headView: true, at }));
      for (const box of [layout.her, layout.bubble, layout.strip, layout.question, layout.input]) expect(whole(box)).toBe(true);
    }
  });

  it('draws her at the Auto share of the screen height under Auto', () => {
    expect(bubbleLayout(input({ scale: 'auto' })).her.h).toBeCloseTo(SCREEN.height * BUBBLE_AUTO_SHARE);
  });

  it('caps her height so the group fits inside the screen margins', () => {
    const layout = bubbleLayout(input({ scale: MASCOT_SCALE_MAX, base: { width: 600, height: 1200 }, mask: { x: 100, y: 0, width: 400, height: 400 } }));
    expect(layout.bubble.y).toBeGreaterThanOrEqual(SCREEN_MARGIN);
    expect(layout.bubble.h).toBeGreaterThanOrEqual(BUBBLE_MIN_HEIGHT);
    expect(bottomOf(layout.her)).toBeLessThanOrEqual(SCREEN.height - SCREEN_MARGIN);
  });

  it('stands her at the bottom right by default', () => {
    const layout = bubbleLayout(input({ at: null }));
    expect(layout.side).toBe('right');
    expect(rightOf(layout.her)).toBeGreaterThan(SCREEN.width - 100);
    expect(whole(layout.her)).toBe(true);
  });
});

describe('the bubble layout in head view', () => {
  const head = (change: Partial<BubbleInput> = {}) => bubbleLayout(input({ headView: true, scale: 'auto', ...change }));

  it('stacks the bubble, the strip, the question and the input in one column, with the head above the input', () => {
    const layout = head();
    expect(bottomOf(layout.bubble)).toBeLessThan(layout.strip.y);
    expect(bottomOf(layout.strip)).toBeLessThanOrEqual(layout.question.y);
    expect(bottomOf(layout.question)).toBeLessThanOrEqual(layout.input.y);
    expect(bottomOf(layout.her)).toBeLessThanOrEqual(layout.input.y);
    expect(bottomOf(layout.bubble)).toBeLessThan(layout.her.y);
    for (const box of [layout.bubble, layout.input]) expect(box.x).toBe(layout.bubble.x);
  });

  it('points the tail down at the head', () => {
    const layout = head();
    expect(layout.tail).toEqual({ x: layout.her.x + layout.her.w / 2, y: bottomOf(layout.bubble), points: 'down' });
  });

  it('stands the head in the column corner nearest the screen edge, with the strip and the question beside it', () => {
    const right = head();
    expect(rightOf(right.her)).toBe(rightOf(right.bubble));
    expect(right.strip.x).toBe(right.bubble.x);
    expect(rightOf(right.strip)).toBeLessThan(right.her.x);
    expect(rightOf(right.question)).toBeLessThan(right.her.x);
    const left = head({ at: { x: 300, y: 850 } });
    expect(left.her.x).toBe(left.bubble.x);
    expect(left.strip.x).toBeGreaterThan(rightOf(left.her));
    expect(rightOf(left.strip)).toBe(rightOf(left.bubble));
  });

  it('stands a tall head on the input and hangs the strip under the bubble', () => {
    const layout = head({ scale: MASCOT_SCALE_MAX });
    expect(layout.her.h).toBeGreaterThan(layout.question.y - layout.strip.y);
    expect(bottomOf(layout.her)).toBe(layout.input.y - BUBBLE_GAP);
    expect(layout.strip.y).toBe(layout.her.y);
    expect(bottomOf(layout.question)).toBe(bottomOf(layout.her));
  });

  it('keeps the Auto head at the fixed head height, and a large head to half the column', () => {
    expect(head().her.h).toBe(HEAD_HEIGHT);
    const large = head({ scale: MASCOT_SCALE_MAX });
    expect(large.her.w).toBe(large.bubble.w / 2);
  });

  it('never caps the head under the smallest Scale: a narrow chat widens to keep room beside it', () => {
    // The smallest head is 50 × 50 here; a chat too narrow for it and the strip grows.
    const wide = head({ scale: MASCOT_SCALE_MIN, width: 1000 });
    const narrow = head({ scale: MASCOT_SCALE_MIN, width: 60 });
    expect(narrow.her.h).toBe(wide.her.h);
    expect(narrow.her.h).toBe(MASK.height * MASCOT_SCALE_MIN / 100);
    expect(narrow.strip.w).toBeGreaterThanOrEqual(180);
    expect(narrow.bubble.w).toBeGreaterThanOrEqual(narrow.her.w + BUBBLE_GAP + 180);
  });

  it('caps a long answer at the room above the head', () => {
    const layout = head({ heights: { content: 5000, question: 32, input: 44 } });
    expect(layout.bubble.y).toBe(SCREEN_MARGIN);
  });
});

describe('the Mascot grip', () => {
  it('sits on her top corner on the bubble side, apart from the chat grip', () => {
    expect(bubbleLayout(input()).mascotGrip).toBe('nw');
    expect(bubbleLayout(input({ at: { x: 300, y: 850 } })).mascotGrip).toBe('ne');
  });

  it('grows her toward the open space and keeps her feet and outer side fixed', () => {
    const start: BubbleLayout = bubbleLayout(input());
    // Her grip is on her top left corner, so up and left grows her.
    const { scale, at } = resizeMascot(input(), start, -60, -60);
    expect(scale).toBeGreaterThan(100);
    const after = bubbleLayout(input({ scale, at }));
    expect(bottomOf(after.her)).toBe(bottomOf(start.her));
    expect(rightOf(after.her)).toBeCloseTo(rightOf(start.her));
  });

  it('shrinks her on a drag toward her', () => {
    const start = bubbleLayout(input());
    expect(resizeMascot(input(), start, 60, 60).scale).toBeLessThan(100);
  });

  it('writes a percent from Auto at the size she has, so a still press does not jump her', () => {
    const start = bubbleLayout(input({ scale: 'auto' }));
    const { scale } = resizeMascot(input({ scale: 'auto' }), start, 0, 0);
    // A whole percent of the base is the only rounding.
    expect(Math.abs(bubbleLayout(input({ scale })).her.h - start.her.h)).toBeLessThanOrEqual(BASE.height / 100);
  });

  it('writes a percent from the Auto head in head view, so the head does not jump', () => {
    const headInput = input({ headView: true, scale: 'auto' });
    const start = bubbleLayout(headInput);
    const { scale } = resizeMascot(headInput, start, 0, 0);
    expect(Math.abs(bubbleLayout({ ...headInput, scale }).her.h - start.her.h)).toBeLessThanOrEqual(MASK.height / 100);
  });

  it('keeps the head view head on its outer side', () => {
    // Half the Mask, so the drag grows the head under the column's cap.
    const headInput = input({ headView: true, scale: 50 });
    const start = bubbleLayout(headInput);
    const { scale, at } = resizeMascot(headInput, start, -40, -40);
    const after = bubbleLayout({ ...headInput, scale, at });
    expect(after.her.h).toBeGreaterThan(start.her.h);
    expect(rightOf(after.her)).toBeCloseTo(rightOf(start.her));
  });
});

describe('the chat grip', () => {
  it('widens the bubble toward the open space and leaves her alone', () => {
    const start = bubbleLayout(input());
    // The chat grip is on the room's top left corner, so a drag left widens it.
    const { w, h } = resizeChat(input(), start, -100, 0);
    expect(w).toBe(start.bubble.w + 100);
    expect(h).toBe(start.chat.h);
    const after = bubbleLayout(input({ width: w, height: h }));
    expect(after.her).toEqual(start.her);
    expect(rightOf(after.bubble)).toBe(rightOf(start.bubble));
    expect(after.input.w).toBe(w);
  });

  it('fits the chat room to the answer until the grip sets one', () => {
    const layout = bubbleLayout(input({ heights: { content: 160, question: 32, input: 44 } }));
    expect(layout.chat).toEqual(layout.bubble);
  });

  it('makes the chat room taller up from her head, with the grip on its corner, and leaves her alone', () => {
    const start = bubbleLayout(input());
    expect(start.grip).toBe('nw');
    const { w, h } = resizeChat(input(), start, 0, -120);
    expect(w).toBe(start.chat.w);
    expect(h).toBe(start.chat.h + 120);
    const after = bubbleLayout(input({ width: w, height: h }));
    expect(after.her).toEqual(start.her);
    expect(after.chat.h).toBe(start.chat.h + 120);
    expect(bottomOf(after.chat)).toBe(bottomOf(start.chat));
    expect(after.group.y).toBe(Math.min(after.her.y, after.chat.y));
  });

  it("fits a short answer inside a set room, and scrolls a long one at the room height, as Minimal's bubbles do", () => {
    const short = bubbleLayout(input({ height: 300, heights: { content: 160, question: 32, input: 44 } }));
    expect(short.chat.h).toBe(300);
    expect(short.bubble.h).toBe(160);
    expect(bottomOf(short.bubble)).toBe(bottomOf(short.chat));
    expect(short.scrolls).toBe(false);
    const long = bubbleLayout(input({ height: 300, heights: { content: 5000, question: 32, input: 44 } }));
    expect(long.bubble).toEqual(long.chat);
    expect(long.bubble.h).toBe(300);
    expect(long.scrolls).toBe(true);
  });

  it('fits a short answer inside a set room in head view too', () => {
    const layout = bubbleLayout(input({ headView: true, height: 300, heights: { content: 160, question: 32, input: 44 } }));
    expect(layout.chat.h).toBe(300);
    expect(layout.bubble.h).toBe(160);
    expect(bottomOf(layout.bubble)).toBe(bottomOf(layout.chat));
  });

  it('keeps a set room inside the screen margin and over the minimum', () => {
    const start = bubbleLayout(input());
    const tall = resizeChat(input(), start, 0, -5000);
    expect(bubbleLayout(input({ height: tall.h })).chat.y).toBe(M);
    const flat = resizeChat(input(), start, 0, 5000);
    expect(flat.h).toBe(bubbleLayout(input({ heights: { content: 0, question: 32, input: 44 } })).chat.h);
  });

  it('sets the reader at the chat room top', () => {
    const layout = bubbleLayout(input({ height: 300, showReader: true }));
    expect(layout.reader?.y).toBe(layout.chat.y);
  });

  it('keeps the chat width when her scale changes', () => {
    expect(bubbleLayout(input({ scale: 80 })).bubble.w).toBe(bubbleLayout(input({ scale: 120 })).bubble.w);
    expect(bubbleLayout(input({ width: 500, scale: 80 })).bubble.w).toBe(500);
    expect(bubbleLayout(input({ width: 500, scale: 120 })).bubble.w).toBe(500);
  });

  it('never narrows the bubble under its minimum', () => {
    const start = bubbleLayout(input());
    expect(resizeChat(input(), start, 5000, 0).w).toBe(320);
  });
});

describe('the scroll state', () => {
  it('scrolls only an answer taller than the bubble', () => {
    expect(bubbleLayout(input({ heights: { content: 160, question: 32, input: 44 } })).scrolls).toBe(false);
    expect(bubbleLayout(input({ heights: { content: 5000, question: 32, input: 44 } })).scrolls).toBe(true);
    expect(bubbleLayout(input({ headView: true, heights: { content: 5000, question: 32, input: 44 } })).scrolls).toBe(true);
  });
});
