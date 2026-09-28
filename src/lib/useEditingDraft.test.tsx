import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditingDraft } from './useEditingDraft';

describe('useEditingDraft', () => {
  it('builds two writes in one event on each other', () => {
    const write = vi.fn();
    const item = { a: 1, b: 1 };
    const { result } = renderHook(() => useEditingDraft(item, write));
    act(() => {
      result.current.setField('a', 2);
      result.current.setField('b', 2);
    });
    expect(write).toHaveBeenLastCalledWith({ a: 2, b: 2 });
    expect(result.current.draft).toEqual({ a: 2, b: 2 });
  });
});
