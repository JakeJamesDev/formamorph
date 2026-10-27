// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { currentHelpSettings, useHelpSettings } from './useHelpSettings';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';

const KEY = 'FORMAMORPH_helpSettings';

beforeEach(() => {
  localStorage.clear();
});

describe('useHelpSettings', () => {
  it('gives every instance the same settings, so a change in one reaches the other', () => {
    const first = renderHook(() => useHelpSettings());
    const second = renderHook(() => useHelpSettings());

    act(() => first.result.current[1]({ historyLength: 7 }));

    expect(second.result.current[0].historyLength).toBe(7);
    expect(currentHelpSettings().historyLength).toBe(7);
  });

  it('reads the defaults while nothing is stored, and writes nothing until a change', () => {
    const { result } = renderHook(() => useHelpSettings());

    expect(result.current[0]).toEqual(DEFAULT_HELP_SETTINGS);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('stores a change, and a later mount reads it back', () => {
    const first = renderHook(() => useHelpSettings());
    act(() => first.result.current[1]({ historyLength: 9 }));
    first.unmount();

    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').historyLength).toBe(9);
    expect(renderHook(() => useHelpSettings()).result.current[0].historyLength).toBe(9);
  });

  it('follows storage that changed under it', () => {
    const { result } = renderHook(() => useHelpSettings());
    act(() => result.current[1]({ historyLength: 3 }));

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new Event('storage'));
    });

    expect(result.current[0]).toEqual(DEFAULT_HELP_SETTINGS);
  });

  it('keeps a change for the session when storage refuses the write', () => {
    const { result } = renderHook(() => useHelpSettings());
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      act(() => result.current[1]({ historyLength: 5 }));
    } finally {
      Storage.prototype.setItem = original;
    }

    expect(result.current[0].historyLength).toBe(5);
  });

  it('reads the defaults on a fresh mount when storage is blocked, whatever an earlier mount changed', () => {
    const first = renderHook(() => useHelpSettings());
    act(() => first.result.current[1]({ historyLength: 6 }));
    first.unmount();
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    try {
      expect(renderHook(() => useHelpSettings()).result.current[0]).toEqual(DEFAULT_HELP_SETTINGS);
    } finally {
      blocked.mockRestore();
    }
  });
});
