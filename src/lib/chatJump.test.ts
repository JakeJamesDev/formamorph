import { describe, expect, it } from 'vitest';
import { jumpTarget, jumpVisible, latestPlacement } from './chatJump';

// A 600px viewport over 5000px of content: the largest scroll offset is 4400.
const viewportHeight = 600;
const maxScroll = 4400;

describe('jumpTarget', () => {
  it('puts a short turn with its action at the viewport top', () => {
    expect(jumpTarget({ turnTop: 3000, contentEnd: 3300, viewportHeight, maxScroll })).toBe(3000);
  });

  it('puts a long turn with its end at the viewport bottom', () => {
    expect(jumpTarget({ turnTop: 3000, contentEnd: 4200, viewportHeight, maxScroll })).toBe(3600);
  });

  it('never goes past the largest scroll offset', () => {
    expect(jumpTarget({ turnTop: 4700, contentEnd: 4900, viewportHeight, maxScroll })).toBe(4400);
  });

  it('never goes above the top of the list', () => {
    expect(jumpTarget({ turnTop: 0, contentEnd: 200, viewportHeight, maxScroll: 0 })).toBe(0);
  });
});

describe('jumpVisible', () => {
  const viewport = { top: 3000, bottom: 3600 };

  it('shows when the latest turn is not mounted', () => {
    expect(jumpVisible(null, viewport)).toBe(true);
  });

  it('shows when the latest content ends below the viewport', () => {
    expect(jumpVisible(3700, viewport)).toBe(true);
  });

  it('shows when the latest content ends above the viewport', () => {
    expect(jumpVisible(2900, viewport)).toBe(true);
  });

  it('hides when the latest content ends inside the viewport', () => {
    expect(jumpVisible(3300, viewport)).toBe(false);
  });

  it('hides when the latest content ends on the viewport bottom, within a rounding pixel', () => {
    expect(jumpVisible(3600.5, viewport)).toBe(false);
  });
});

describe('latestPlacement', () => {
  const viewport = { top: 3000, bottom: 3600 };

  it('places an unmounted latest turn below: it is the last turn of the list', () => {
    expect(latestPlacement(null, viewport)).toBe('below');
  });

  it('places content that ends past the viewport bottom below', () => {
    expect(latestPlacement(3700, viewport)).toBe('below');
  });

  it('places content that ends before the viewport top above', () => {
    expect(latestPlacement(2900, viewport)).toBe('above');
  });

  it('places content that ends in the viewport inside', () => {
    expect(latestPlacement(3300, viewport)).toBe('inside');
  });
});
