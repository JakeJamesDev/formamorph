import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  resolveEffectivePreset,
  resolvePinnedPreset,
  useWorldPromptPresets,
  GLOBAL_PRESET_VALUE,
} from './worldPromptPreset';
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

describe('resolveEffectivePreset', () => {
  const store = storeWith(['mine', 'theirs']);

  it('lets a world pin beat the group it sits in', () => {
    expect(resolveEffectivePreset('mine', 'theirs', store))
      .toEqual({ presetId: 'mine', source: 'world' });
  });

  it('applies the group setting to a world with no pin of its own', () => {
    expect(resolveEffectivePreset(undefined, 'theirs', store))
      .toEqual({ presetId: 'theirs', source: 'group' });
  });

  it('leaves a world with neither following the global selection', () => {
    expect(resolveEffectivePreset(undefined, undefined, store))
      .toEqual({ presetId: null, source: 'global' });
  });

  it('drops to the group when the world pin names a deleted preset', () => {
    expect(resolveEffectivePreset('gone', 'theirs', store))
      .toEqual({ presetId: 'theirs', source: 'group' });
  });

  it('drops to the global selection when the group setting names a deleted preset', () => {
    // A stale group setting must never block entering a world, so it fails silently to the next level.
    expect(resolveEffectivePreset(undefined, 'gone', store))
      .toEqual({ presetId: null, source: 'global' });
  });

  it('drops all the way to global when both levels name deleted presets', () => {
    expect(resolveEffectivePreset('gone', 'also-gone', store))
      .toEqual({ presetId: null, source: 'global' });
  });

  it('accepts a built-in at either level', () => {
    expect(resolveEffectivePreset('simple', undefined, emptyStore).source).toBe('world');
    expect(resolveEffectivePreset(undefined, 'simple', emptyStore).source).toBe('group');
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
