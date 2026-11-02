import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Entity } from '@/types';
import { defaultCharacterData } from './legacyVrm';
import { useSeedAvatarOnSaveLoad } from './useLibraryAvatars';

// Vitest serves the build's define as a global, so the real modules read this value as a `none` build would.
vi.hoisted(() => { (globalThis as Record<string, unknown>).__AVATAR_SET__ = 'none'; });

const contexts = vi.hoisted(() => ({
  entities: [] as unknown[],
  setCharacterData: (() => undefined) as (data: unknown) => void,
}));
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ entities: contexts.entities, worldOverview: {} }),
}));
vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({ characterData: null, setCharacterData: contexts.setCharacterData }),
}));

/** The hook after one save load, on a world with `entities`; returns what it seeded. */
const seededOn = (entities: Partial<Entity>[]) => {
  const setCharacterData = vi.fn();
  contexts.entities = entities;
  contexts.setCharacterData = setCharacterData;
  const { rerender } = renderHook(({ loads }) => useSeedAvatarOnSaveLoad(loads, true, null), { initialProps: { loads: 0 } });
  rerender({ loads: 1 });
  return setCharacterData;
};

describe('seeding customization on a save load, on a build with no bundled Avatar', () => {
  it("seeds a save on User's Default, whose Avatar may be in the library", () => {
    expect(seededOn([{ id: 'custom', customPersona: true, vrmPick: { kind: 'default' } }])).toHaveBeenCalledWith(defaultCharacterData);
  });

  it('seeds nothing for a world with no Avatar pick', () => {
    expect(seededOn([{ id: 'custom', customPersona: true }])).not.toHaveBeenCalled();
  });
});
