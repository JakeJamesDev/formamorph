import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { EntityVisualPreference } from '@/types';
import { useEntityVisualPreference } from './useEntityVisualPreference';

const state = vi.hoisted(() => ({ preference: {} as EntityVisualPreference }));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    entityVisualPreference: state.preference,
    setEntityVisualPreference: (
      update: EntityVisualPreference | ((prev: EntityVisualPreference) => EntityVisualPreference),
    ) => {
      state.preference = typeof update === 'function' ? update(state.preference) : update;
    },
  }),
}));

beforeEach(() => { state.preference = {}; });

describe('useEntityVisualPreference', () => {
  it('reads and writes only the named entity, leaving the rest of the map alone', () => {
    state.preference = { other: 'model' };
    const { result } = renderHook(() => useEntityVisualPreference('sedge'));

    expect(result.current.preference).toBeUndefined();
    act(() => result.current.onPreferenceChange('model'));
    expect(state.preference).toEqual({ other: 'model', sedge: 'model' });
  });

  it('deletes the entry rather than storing a blank one, so the map stays absent when unused', () => {
    state.preference = { sedge: 'image' };
    const { result } = renderHook(() => useEntityVisualPreference('sedge'));

    expect(result.current.preference).toBe('image');
    act(() => result.current.onPreferenceChange(undefined));
    // An empty map is what keeps the field out of the save envelope entirely.
    expect(state.preference).toEqual({});
  });

  it('does nothing without an entity id, rather than writing under an undefined key', () => {
    const { result } = renderHook(() => useEntityVisualPreference(undefined));

    expect(result.current.preference).toBeUndefined();
    act(() => result.current.onPreferenceChange('model'));
    expect(state.preference).toEqual({});
  });
});
