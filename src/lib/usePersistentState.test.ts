import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePersistentState, boolCodec, intCodec, floatCodec, nullableIntCodec } from './usePersistentState';

describe('primitive codecs reject invalid stored values', () => {
  it('boolCodec throws on a non-JSON token (e.g. a truncated "tru")', () => {
    expect(() => boolCodec.parse('tru')).toThrow();
    expect(boolCodec.parse('true')).toBe(true);
  });

  it('intCodec/floatCodec throw on unparseable input instead of returning NaN', () => {
    expect(() => intCodec.parse('abc')).toThrow();
    expect(() => floatCodec.parse('abc')).toThrow();
    expect(intCodec.parse('42')).toBe(42);
    expect(floatCodec.parse('1.5')).toBe(1.5);
  });

  it('nullableIntCodec keeps empty→null but throws on garbage', () => {
    expect(nullableIntCodec.parse('')).toBeNull();
    expect(() => nullableIntCodec.parse('xyz')).toThrow();
  });
});

describe('usePersistentState survives a corrupt stored value', () => {
  beforeEach(() => localStorage.clear());

  it('seeds the default (not a crash) when the stored value fails to parse', () => {
    localStorage.setItem('fmtest_flag', 'tru'); // corrupt boolean
    const { result } = renderHook(() => usePersistentState('fmtest_flag', true, boolCodec));
    expect(result.current[0]).toBe(true);
  });

  it('rewrites the corrupt key with the serialized default (self-heal)', () => {
    localStorage.setItem('fmtest_num', 'not-a-number');
    renderHook(() => usePersistentState('fmtest_num', 7, intCodec));
    expect(localStorage.getItem('fmtest_num')).toBe('7');
  });

  it('still seeds a valid stored value normally', () => {
    localStorage.setItem('fmtest_num', '13');
    const { result } = renderHook(() => usePersistentState('fmtest_num', 7, intCodec));
    expect(result.current[0]).toBe(13);
  });
});
