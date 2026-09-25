import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('keeps a title scrim beside a background color', () => {
    expect(cn('bg-card', 'bg-title-scrim')).toBe('bg-card bg-title-scrim');
    expect(cn('bg-title-scrim-top', 'bg-muted')).toBe('bg-title-scrim-top bg-muted');
  });

  it('lets later Tailwind classes win conflicts (twMerge)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('px-2', 'p-4')).toBe('p-4');
  });

  it('supports clsx object syntax', () => {
    expect(cn({ active: true, hidden: false })).toBe('active');
  });
});
