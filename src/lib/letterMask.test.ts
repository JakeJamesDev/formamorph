import { describe, it, expect } from 'vitest';
import { letterMask, MASK_CACHE_LIMIT, type MaskCanvasFactory } from './letterMask';

/** A stand-in canvas that inks one pixel per drawn letter and records what it was asked to draw. */
function fakeCanvas() {
  const calls: string[] = [];
  const factory: MaskCanvasFactory = (width, height) => ({
    getContext: () => {
      const ctx = {
        font: '', textAlign: 'start', lineJoin: 'miter', lineWidth: 1,
        translate: () => {},
        rotate: (angle: number) => calls.push(`rotate ${angle.toFixed(4)}`),
        fillText: (text: string) => calls.push(`fill ${text} ${ctx.font}`),
        strokeText: () => {},
        getImageData: () => {
          const data = new Uint8ClampedArray(width * height * 4);
          data[(236 * width + 100) * 4 + 3] = 255;
          data[(236 * width + 101) * 4 + 3] = 128;
          return { data };
        },
      };
      // Only the members letterMask calls; a full CanvasRenderingContext2D is out of reach in jsdom.
      return ctx as unknown as ReturnType<ReturnType<MaskCanvasFactory>['getContext']>;
    },
  });
  return { factory, calls };
}

describe('letterMask', () => {
  it('draws the letter in the font and tilt, and reads ink above half alpha', () => {
    const { factory, calls } = fakeCanvas();
    const mask = letterMask('A', 'Fake Sans', 6.5, factory);
    expect(calls).toEqual([`rotate ${((6.5 * Math.PI) / 180).toFixed(4)}`, 'fill A 800 118px Fake Sans']);
    expect(mask.ink(100, 236)).toBe(true);
    expect(mask.ink(101, 236)).toBe(false);
    expect(mask.ink(-1, 236)).toBe(false);
    expect(mask.ink(200, 236)).toBe(false);
  });

  it('caches by letter, font and tilt', () => {
    const { factory, calls } = fakeCanvas();
    const first = letterMask('B', 'Fake Sans', 5, factory);
    expect(letterMask('B', 'Fake Sans', 5, factory)).toBe(first);
    letterMask('C', 'Fake Sans', 5, factory);
    letterMask('B', 'Fake Serif', 5, factory);
    letterMask('B', 'Fake Sans', -5, factory);
    expect(calls.filter((c) => c.startsWith('fill'))).toHaveLength(4);
  });

  it('drops the least recently used mask past the limit', () => {
    const { factory, calls } = fakeCanvas();
    const draws = () => calls.filter((c) => c.startsWith('fill')).length;
    letterMask('F', 'Evict Sans', 4, factory);
    letterMask('G', 'Evict Sans', 4, factory);
    for (let i = 0; i < MASK_CACHE_LIMIT - 1; i++) {
      letterMask('F', 'Evict Sans', 4, factory);
      letterMask('H', 'Evict Sans', 10 + i, factory);
    }
    expect(draws()).toBe(MASK_CACHE_LIMIT + 1);
    // F was read on every pass, so G is the oldest and the one dropped.
    letterMask('F', 'Evict Sans', 4, factory);
    expect(draws()).toBe(MASK_CACHE_LIMIT + 1);
    letterMask('G', 'Evict Sans', 4, factory);
    expect(draws()).toBe(MASK_CACHE_LIMIT + 2);
  });

  it('draws again while the font is still loading', () => {
    const { factory, calls } = fakeCanvas();
    const had = Object.getOwnPropertyDescriptor(document, 'fonts');
    let loaded = false;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { check: () => loaded } });
    try {
      letterMask('E', 'Web Font', 5, factory);
      letterMask('E', 'Web Font', 5, factory);
      loaded = true;
      letterMask('E', 'Web Font', 5, factory);
      letterMask('E', 'Web Font', 5, factory);
    } finally {
      if (had) Object.defineProperty(document, 'fonts', had);
      else delete (document as { fonts?: unknown }).fonts;
    }
    expect(calls.filter((c) => c.startsWith('fill'))).toHaveLength(3);
  });

  it('gives an empty mask without a 2D context', () => {
    const mask = letterMask('D', 'Fake Sans', 4, () => ({ getContext: () => null }));
    expect(mask.ink(100, 236)).toBe(false);
  });
});
