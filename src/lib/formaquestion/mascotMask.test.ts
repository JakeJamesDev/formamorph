import { describe, it, expect } from 'vitest';
import { cropFrame, fitMask, gripKeyDelta, headSize, headSizeWithin, maskFromDrag, moveMaskGrip, sizeWithin, type MaskGrip } from './mascotMask';

const BASE = { width: 888, height: 1184 };

describe('moveMaskGrip', () => {
  const MASK = { x: 100, y: 200, width: 400, height: 300 };
  const by = (grip: MaskGrip, x: number, y: number) => moveMaskGrip(MASK, grip, { x, y }, BASE);

  it('moves the one edge a side handle holds, on its own axis', () => {
    expect(by('n', 7, -20)).toEqual({ x: 100, y: 180, width: 400, height: 320 });
    expect(by('s', 7, 20)).toEqual({ x: 100, y: 200, width: 400, height: 320 });
    expect(by('w', -30, 9)).toEqual({ x: 70, y: 200, width: 430, height: 300 });
    expect(by('e', 30, 9)).toEqual({ x: 100, y: 200, width: 430, height: 300 });
  });

  it('moves the two edges a corner holds', () => {
    expect(by('nw', -10, -20)).toEqual({ x: 90, y: 180, width: 410, height: 320 });
    expect(by('ne', 10, -20)).toEqual({ x: 100, y: 180, width: 410, height: 320 });
    expect(by('se', 10, 20)).toEqual({ x: 100, y: 200, width: 410, height: 320 });
    expect(by('sw', -10, 20)).toEqual({ x: 90, y: 200, width: 410, height: 320 });
  });

  it('moves the whole box from the middle, keeping its size', () => {
    expect(by('move', -40, 60)).toEqual({ x: 60, y: 260, width: 400, height: 300 });
  });

  it('keeps every edge inside the base', () => {
    expect(by('nw', -500, -500)).toEqual({ x: 0, y: 0, width: 500, height: 500 });
    expect(by('se', 5000, 5000)).toEqual({ x: 100, y: 200, width: 788, height: 984 });
    expect(by('move', -500, 5000)).toEqual({ x: 0, y: 884, width: 400, height: 300 });
    expect(by('move', 5000, -500)).toEqual({ x: 488, y: 0, width: 400, height: 300 });
  });

  it('stops an edge at the minimum size, whichever way it is dragged', () => {
    expect(by('e', -1000, 0)).toEqual({ x: 100, y: 200, width: 16, height: 300 });
    expect(by('w', 1000, 0)).toEqual({ x: 484, y: 200, width: 16, height: 300 });
    expect(by('n', 0, 1000)).toEqual({ x: 100, y: 484, width: 400, height: 16 });
    expect(by('s', 0, -1000)).toEqual({ x: 100, y: 200, width: 400, height: 16 });
  });

  it('gives whole base pixels for a drag measured in fractions', () => {
    expect(by('se', 10.4, 19.6)).toEqual({ x: 100, y: 200, width: 410, height: 320 });
    expect(by('move', 0.6, -0.4)).toEqual({ x: 101, y: 200, width: 400, height: 300 });
  });
});

describe('gripKeyDelta', () => {
  it('steps one base pixel per arrow key, ten with Shift', () => {
    expect(gripKeyDelta('move', 'ArrowLeft', false)).toEqual({ x: -1, y: 0 });
    expect(gripKeyDelta('move', 'ArrowDown', true)).toEqual({ x: 0, y: 10 });
    expect(gripKeyDelta('se', 'ArrowRight', true)).toEqual({ x: 10, y: 0 });
    expect(gripKeyDelta('nw', 'ArrowUp', false)).toEqual({ x: 0, y: -1 });
  });

  it('ignores a key off a side handle\'s axis, and any other key', () => {
    expect(gripKeyDelta('e', 'ArrowUp', false)).toBeNull();
    expect(gripKeyDelta('w', 'ArrowDown', false)).toBeNull();
    expect(gripKeyDelta('n', 'ArrowLeft', false)).toBeNull();
    expect(gripKeyDelta('s', 'ArrowRight', true)).toBeNull();
    expect(gripKeyDelta('e', 'ArrowLeft', false)).toEqual({ x: -1, y: 0 });
    expect(gripKeyDelta('s', 'ArrowUp', false)).toEqual({ x: 0, y: -1 });
    expect(gripKeyDelta('move', 'Enter', false)).toBeNull();
  });
});

describe('maskFromDrag', () => {
  it('gives the box between two points in whole base pixels, whichever way the drag went', () => {
    expect(maskFromDrag({ x: 100.4, y: 20.6 }, { x: 600.2, y: 500.5 }, BASE)).toEqual({ x: 100, y: 21, width: 500, height: 480 });
    expect(maskFromDrag({ x: 600, y: 500 }, { x: 100, y: 20 }, BASE)).toEqual({ x: 100, y: 20, width: 500, height: 480 });
  });

  it('cuts a drag that leaves the base to the base', () => {
    expect(maskFromDrag({ x: -50, y: -10 }, { x: 2000, y: 300 }, BASE)).toEqual({ x: 0, y: 0, width: 888, height: 300 });
  });

  it('gives nothing for a press or a sliver, so the Mask stays', () => {
    expect(maskFromDrag({ x: 300, y: 300 }, { x: 300, y: 300 }, BASE)).toBeNull();
    expect(maskFromDrag({ x: 300, y: 300 }, { x: 700, y: 310 }, BASE)).toBeNull();
    expect(maskFromDrag({ x: -80, y: 300 }, { x: -10, y: 700 }, BASE)).toBeNull();
  });
});

describe('fitMask', () => {
  it('reads no Mask as the whole base', () => {
    expect(fitMask(null, BASE)).toEqual({ x: 0, y: 0, ...BASE });
  });

  it('keeps a Mask inside the base and cuts one that runs past it', () => {
    expect(fitMask({ x: 100, y: 0, width: 768, height: 680 }, BASE)).toEqual({ x: 100, y: 0, width: 768, height: 680 });
    expect(fitMask({ x: 800, y: 1000, width: 400, height: 400 }, BASE)).toEqual({ x: 800, y: 1000, width: 88, height: 184 });
  });

  it('reads a Mask wholly off a smaller base as the whole base', () => {
    expect(fitMask({ x: 900, y: 0, width: 100, height: 100 }, BASE)).toEqual({ x: 0, y: 0, ...BASE });
  });
});

describe('headSize', () => {
  it('takes the height and the Mask aspect', () => {
    expect(headSize({ x: 0, y: 0, width: 300, height: 200 }, 64)).toEqual({ w: 96, h: 64 });
  });
});

describe('headSizeWithin', () => {
  it('keeps the height while the Mask aspect fits the width', () => {
    expect(headSizeWithin({ x: 0, y: 0, width: 300, height: 200 }, 64, 96)).toEqual({ w: 96, h: 64 });
  });

  it('shrinks a wider Mask to the width at its aspect', () => {
    expect(headSizeWithin({ x: 0, y: 0, width: 400, height: 100 }, 64, 120)).toEqual({ w: 120, h: 30 });
  });
});

describe('sizeWithin', () => {
  it('keeps the height while the base aspect fits the width', () => {
    expect(sizeWithin(BASE, 240, 400)).toEqual({ w: 180, h: 240 });
  });

  it('shrinks to the width at the base aspect when it runs past', () => {
    expect(sizeWithin(BASE, 240, 150)).toEqual({ w: 150, h: 200 });
  });
});

describe('cropFrame', () => {
  it('places the whole base so the Mask fills the piece', () => {
    expect(cropFrame({ x: 222, y: 296, width: 444, height: 592 }, BASE)).toEqual({ left: -50, top: -50, width: 200, height: 200 });
  });

  it('places the base at the piece for the whole base', () => {
    expect(cropFrame(fitMask(null, BASE), BASE)).toEqual({ left: -0, top: -0, width: 100, height: 100 });
  });
});
