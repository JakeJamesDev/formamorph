import { describe, expect, it } from 'vitest';
import { hasNativeScrollAnchoring } from './scrollAnchoring';

describe('hasNativeScrollAnchoring', () => {
  it('reads the engine support for overflow-anchor', () => {
    const asked: string[] = [];
    const css = { supports: (property: string, value: string) => { asked.push(`${property}: ${value}`); return true; } };
    expect(hasNativeScrollAnchoring(css)).toBe(true);
    expect(asked).toEqual(['overflow-anchor: auto']);
  });

  it('is false on an engine without the property, and without CSS.supports', () => {
    expect(hasNativeScrollAnchoring({ supports: () => false })).toBe(false);
    expect(hasNativeScrollAnchoring({})).toBe(false);
    expect(hasNativeScrollAnchoring(undefined)).toBe(false);
  });
});
