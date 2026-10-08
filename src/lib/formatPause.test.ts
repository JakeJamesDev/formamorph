import { describe, it, expect } from 'vitest';
import { formatPause } from '@/lib/formatPause';

describe('formatPause', () => {
  it.each([
    [10, '10 s'],
    [30, '30 s'],
    [60, '1 min'],
    [90, '1 min 30 s'],
    [300, '5 min'],
  ])('reads %i s as %s', (seconds, text) => {
    expect(formatPause(seconds)).toBe(text);
  });
});
