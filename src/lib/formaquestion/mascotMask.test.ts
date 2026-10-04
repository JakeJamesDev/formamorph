import { describe, it, expect } from 'vitest';
import { cropFrame, fitMask, headSize, maskFromDrag } from './mascotMask';

const BASE = { width: 888, height: 1184 };

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

describe('cropFrame', () => {
  it('places the whole base so the Mask fills the piece', () => {
    expect(cropFrame({ x: 222, y: 296, width: 444, height: 592 }, BASE)).toEqual({ left: -50, top: -50, width: 200, height: 200 });
  });

  it('places the base at the piece for the whole base', () => {
    expect(cropFrame(fitMask(null, BASE), BASE)).toEqual({ left: -0, top: -0, width: 100, height: 100 });
  });
});
