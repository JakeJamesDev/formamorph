import { describe, expect, it } from 'vitest';
import { revealDelta } from './scrollEdgeFade';

const view = { top: 100, bottom: 500 };

describe('revealDelta', () => {
  it('leaves an item alone when it fits with its clearance', () => {
    expect(revealDelta({ top: 200, bottom: 440 }, view, 56)).toBe(0);
  });

  it('scrolls down until the clearance fits under an item in the fade', () => {
    expect(revealDelta({ top: 400, bottom: 480 }, view, 56)).toBe(36);
  });

  it('scrolls down to an item below the view', () => {
    expect(revealDelta({ top: 700, bottom: 780 }, view, 56)).toBe(336);
  });

  it('scrolls up to an item above the view', () => {
    expect(revealDelta({ top: 40, bottom: 80 }, view, 56)).toBe(-60);
  });

  it('keeps the top of an item too tall to fit', () => {
    expect(revealDelta({ top: 300, bottom: 800 }, view, 56)).toBe(200);
    expect(revealDelta({ top: 40, bottom: 800 }, view, 56)).toBe(-60);
  });
});
