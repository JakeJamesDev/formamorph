import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

// Minimal MediaQueryList stub whose `matches` can be flipped to fire registered listeners.
function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '',
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: () => void) => {
      listeners.delete(cb);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    set(value: boolean) {
      matches = value;
      listeners.forEach((cb) => cb());
    },
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return mql;
}

afterEach(() => vi.unstubAllGlobals());

describe('useIsMobile', () => {
  it('returns true when the media query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false when the media query does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates when the media query changes', () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => mql.set(true));
    expect(result.current).toBe(true);
  });
});
