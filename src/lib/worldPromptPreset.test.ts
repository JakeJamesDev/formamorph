import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resolvePinnedPreset, useWorldPromptPresets, GLOBAL_PRESET_VALUE } from './worldPromptPreset';
import { emptyStore, type PromptPresetStore } from './promptPresets';

const storeWith = (ids: string[]): PromptPresetStore => ({
  activeId: 'mine',
  presets: ids.map((id) => ({ id, name: id, values: {} as never })),
});

describe('resolvePinnedPreset', () => {
  it('accepts a pin naming a stored user preset', () => {
    expect(resolvePinnedPreset('mine', storeWith(['mine']))).toBe('mine');
  });

  it('accepts a pin naming a built-in', () => {
    expect(resolvePinnedPreset('simple', emptyStore)).toBe('simple');
  });

  it('reads an unpinned world as following the global preset', () => {
    expect(resolvePinnedPreset(undefined, emptyStore)).toBeNull();
  });

  it('falls back to the global preset when the pinned preset was deleted', () => {
    // Not merely cosmetic: activeValues' own ghost-id fallback resolves an unknown id to the DEFAULT
    // built-in, so without this guard a deleted preset would silently switch the world to Default
    // rather than back to whatever the player has selected globally.
    expect(resolvePinnedPreset('deleted-preset', storeWith(['mine']))).toBeNull();
  });
});

describe('useWorldPromptPresets', () => {
  beforeEach(() => localStorage.clear());

  it('reports no pin for a world never touched', () => {
    const { result } = renderHook(() => useWorldPromptPresets());
    expect(result.current.worldPreset('w1')).toBeUndefined();
  });

  it('pins one world without touching another, and persists', () => {
    const { result } = renderHook(() => useWorldPromptPresets());
    act(() => result.current.setWorldPreset('w1', 'p1'));

    expect(result.current.worldPreset('w1')).toBe('p1');
    expect(result.current.worldPreset('w2')).toBeUndefined();

    const reread = renderHook(() => useWorldPromptPresets());
    expect(reread.result.current.worldPreset('w1')).toBe('p1');
  });

  it('clears a pin back to following the global preset', () => {
    const { result } = renderHook(() => useWorldPromptPresets());
    act(() => result.current.setWorldPreset('w1', 'p1'));
    act(() => result.current.setWorldPreset('w1', null));
    expect(result.current.worldPreset('w1')).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('FORMAMORPH_worldPromptPresets')!)).toEqual({});
  });

  it('reads a corrupt or wrongly-shaped stored value as no pins', () => {
    for (const raw of ['{not json', '["an","array"]']) {
      localStorage.setItem('FORMAMORPH_worldPromptPresets', raw);
      const { result } = renderHook(() => useWorldPromptPresets());
      expect(result.current.worldPreset('w1')).toBeUndefined();
    }
  });

  it('never stores the "use global" sentinel as a pin', () => {
    // The dropdown's default value is a sentinel, not a preset id; storing it would make the pin
    // dangle forever after.
    const { result } = renderHook(() => useWorldPromptPresets());
    act(() => result.current.setWorldPreset('w1', null));
    expect(result.current.worldPreset('w1')).toBeUndefined();
    expect(resolvePinnedPreset(GLOBAL_PRESET_VALUE, emptyStore)).toBeNull();
  });
});
