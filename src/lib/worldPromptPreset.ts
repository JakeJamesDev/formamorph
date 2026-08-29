import { useState, useEffect } from 'react';
import { BUILTIN_PRESETS } from './promptPresets';

/** Everything preset resolution needs: the ids that currently exist. `PromptPresetStore` satisfies it. */
export interface PresetIdSource {
  presets: { id: string }[];
}

const STORAGE_KEY = 'FORMAMORPH_worldPromptPresets';

/** The dropdown entry meaning "whatever preset is selected globally" — the default for every world. */
export const GLOBAL_PRESET_VALUE = '__global__';

/**
 * The preset a world is pinned to, or null when it should follow the global selection. A pin naming a
 * preset that no longer exists reads as null: `activeValues`' own ghost-id fallback lands on the Default
 * built-in, which is not what "my preset was deleted" should mean — the player's global choice is.
 */
export function resolvePinnedPreset(
  pinnedId: string | undefined,
  store: PresetIdSource,
): string | null {
  if (!pinnedId) return null;
  const exists = BUILTIN_PRESETS.some((b) => b.id === pinnedId) || store.presets.some((p) => p.id === pinnedId);
  return exists ? pinnedId : null;
}

/** Which level decided the preset a world runs on. */
export type PresetSource = 'world' | 'group' | 'global';

export interface EffectivePreset {
  /** The preset to run, or null to follow the player's global selection. */
  presetId: string | null;
  source: PresetSource;
}

/**
 * The preset a world actually runs on: its own pin first, then the setting on the library folder it sits
 * in, then the global selection. Each level is validated the same way, so a level naming a deleted preset
 * drops silently to the next rather than breaking entry into the world.
 *
 * @param pinnedId - The world's own pin
 * @param groupPresetId - The preset its library folder applies to its members
 */
export function resolveEffectivePreset(
  pinnedId: string | undefined,
  groupPresetId: string | undefined,
  store: PresetIdSource,
): EffectivePreset {
  const pinned = resolvePinnedPreset(pinnedId, store);
  if (pinned) return { presetId: pinned, source: 'world' };

  const fromGroup = resolvePinnedPreset(groupPresetId, store);
  if (fromGroup) return { presetId: fromGroup, source: 'group' };

  return { presetId: null, source: 'global' };
}

/**
 * Per-world prompt-preset pins, keyed by world id. Local to this device: never exported with a world, never
 * published, and deliberately outside the Backup bundle — the same treatment the README flags get.
 */
export function useWorldPromptPresets() {
  const [pins, setPins] = useState<Record<string, string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch {
      // A full/blocked localStorage costs only the pin; the session keeps the in-memory choice.
    }
  }, [pins]);

  /** The stored pin for a world, or undefined. Validate with `resolvePinnedPreset` before applying it. */
  const worldPreset = (id: string | null | undefined) => (id ? pins[id] : undefined);

  /** Pin a world to a preset, or pass null to go back to following the global selection. */
  const setWorldPreset = (id: string | null | undefined, presetId: string | null) => {
    if (!id) return;
    setPins((prev) => {
      if (!presetId) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: presetId };
    });
  };

  return { worldPreset, setWorldPreset };
}
