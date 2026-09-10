import { describe, it, expect } from 'vitest';
import { PUBLISH_LIMITS, measurePublishBytes, publishSizeBand, formatPublishBytes, publishLimitRefusal } from './publishLimits';

describe('measurePublishBytes', () => {
  it('counts the UTF-8 bytes of the compact serialization, not the character count', () => {
    // "é" and "🐸" are two and four UTF-8 bytes; a naive `.length` count would miss both.
    const content = { name: 'Café 🐸', image: 'data:image/webp;base64,AAAA' };
    const expected = new TextEncoder().encode(JSON.stringify(content)).length;

    expect(measurePublishBytes(content)).toBe(expected);
    expect(measurePublishBytes(content)).not.toBe(JSON.stringify(content).length);
  });

  it('serializes compactly — no indentation inflating the count', () => {
    expect(measurePublishBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
  });
});

describe('publishSizeBand', () => {
  it.each(Object.entries(PUBLISH_LIMITS))('holds the boundaries at exactly 0.6 and 0.9 of the %s limit', (_kind, limit) => {
    expect(publishSizeBand(limit * 0.6 - 1, limit).band).toBe('green');
    expect(publishSizeBand(limit * 0.6, limit).band).toBe('amber');
    expect(publishSizeBand(limit * 0.9 - 1, limit).band).toBe('amber');
    expect(publishSizeBand(limit * 0.9, limit).band).toBe('red');
  });

  it('clamps the ratio at 1.0 for anything at or past the limit', () => {
    const limit = PUBLISH_LIMITS.world;

    expect(publishSizeBand(limit, limit).ratio).toBe(1);
    expect(publishSizeBand(limit * 2, limit).ratio).toBe(1);
  });

  it('reports the unclamped ratio under the limit', () => {
    const limit = PUBLISH_LIMITS.world;

    expect(publishSizeBand(limit * 0.3, limit).ratio).toBeCloseTo(0.3);
  });
});

describe('formatPublishBytes', () => {
  it('formats 1024-based, to one decimal, labeled MB to match the server', () => {
    expect(formatPublishBytes(12.4 * 1024 * 1024)).toBe('12.4 MB');
    expect(formatPublishBytes(12.44 * 1024 * 1024)).toBe('12.4 MB');
  });

  it('shows a whole number bare, so the limit reads as the server states it', () => {
    expect(formatPublishBytes(100 * 1024 * 1024)).toBe('100 MB');
    expect(formatPublishBytes(100.04 * 1024 * 1024)).toBe('100 MB');
  });
});

describe('publishLimitRefusal', () => {
  it('names the kind label, the size, and the limit', () => {
    const bytes = PUBLISH_LIMITS.entity + 1024 * 1024;

    expect(publishLimitRefusal('entity', bytes)).toBe('Entity is 26 MB, over the 25 MB publish limit.');
  });

  it('names each kind with its own label and limit', () => {
    expect(publishLimitRefusal('world', PUBLISH_LIMITS.world + 1)).toContain('World is');
    expect(publishLimitRefusal('dictionary', PUBLISH_LIMITS.dictionary + 1)).toContain('Dictionary is');
    expect(publishLimitRefusal('model', PUBLISH_LIMITS.model + 1)).toContain('Avatar is');
  });
});
