import { randomUUID } from '@/lib/uuid';
import type { Codec } from './usePersistentState';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS } from '../contexts/settingsDefaults';

/** The custom text-endpoint fields a preset captures. Everything desktop-local (GPU layers, sampling, the
 *  local Max Output cap) and every global toggle stays out — this is only the "point at your own API" set. */
export interface TextEndpointValues {
  endpoint: string;
  apiToken: string;
  model: string;
  /** Manual context-window override; null = use the auto-detected value. */
  contextWindowOverride: number | null;
  maxTokens: number;
}

export type TextEndpointValueKey = keyof TextEndpointValues;

/** A named custom-endpoint config. The immutable "Default" built-in is virtual (never stored); only
 *  user presets live in the store's `presets`. */
export interface TextEndpointPreset {
  id: string;
  name: string;
  values: TextEndpointValues;
}

export interface TextEndpointPresetStore {
  activeId: string;
  presets: TextEndpointPreset[];
}

/** The read-only "Default" preset — the shipped/embedded shared endpoint. Selecting it = "use our endpoint". */
export const DEFAULT_TEXT_PRESET_ID = 'default';

/** The Default preset's values: the built-in shared endpoint (honors VITE_DEFAULT_* via settingsDefaults). */
export const DEFAULT_TEXT_ENDPOINT_VALUES: TextEndpointValues = {
  endpoint: DEFAULT_ENDPOINT,
  apiToken: DEFAULT_API_TOKEN,
  model: DEFAULT_MODEL_NAME,
  contextWindowOverride: null,
  maxTokens: DEFAULT_MAX_TOKENS,
};

/** The initial store: no user presets, the Default built-in active. */
export const emptyStore: TextEndpointPresetStore = { activeId: DEFAULT_TEXT_PRESET_ID, presets: [] };

/** Layer a raw JSON entry over the built-in defaults, coercing each field by type (unknown keys ignored). */
function coerceValues(rec: Record<string, unknown>): TextEndpointValues {
  const d = DEFAULT_TEXT_ENDPOINT_VALUES;
  const str = (k: string, dflt: string) => (typeof rec[k] === 'string' ? (rec[k] as string) : dflt);
  const num = (k: string, dflt: number) => (typeof rec[k] === 'number' && Number.isFinite(rec[k]) ? (rec[k] as number) : dflt);
  return {
    endpoint: str('endpoint', d.endpoint),
    apiToken: str('apiToken', d.apiToken),
    model: str('model', d.model),
    contextWindowOverride:
      typeof rec.contextWindowOverride === 'number' && Number.isFinite(rec.contextWindowOverride)
        ? (rec.contextWindowOverride as number)
        : null,
    maxTokens: num('maxTokens', d.maxTokens),
  };
}

/**
 * Build a store from the VITE_DEFAULT_TEXT_PRESETS env var — a JSON array of `{ name, ...partial values }`
 * entries, each layered over the built-in defaults (so a preset need only list what differs). Returns null
 * when the var is unset or malformed, letting the caller fall back to the Default-only store.
 */
export function presetStoreFromEnv(
  raw: string | undefined = import.meta.env.VITE_DEFAULT_TEXT_PRESETS,
): TextEndpointPresetStore | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const presets: TextEndpointPreset[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) continue;
    presets.push({ id: randomUUID(), name, values: coerceValues(rec) });
  }
  if (presets.length === 0) return null;
  return { activeId: presets[0].id, presets };
}

/** localStorage codec; any malformed value falls back to the empty (Default-only) store. */
export const textEndpointPresetCodec: Codec<TextEndpointPresetStore> = {
  parse: (raw) => {
    try {
      const parsed = JSON.parse(raw) as Partial<TextEndpointPresetStore>;
      if (!parsed || typeof parsed.activeId !== 'string' || !Array.isArray(parsed.presets)) return emptyStore;
      return { activeId: parsed.activeId, presets: parsed.presets as TextEndpointPreset[] };
    } catch {
      return emptyStore;
    }
  },
  serialize: (v) => JSON.stringify(v),
};

/** The Default built-in is active when the id is 'default', or when it's a ghost id (no matching user
 *  preset) — a defensive fallback. Built-ins are read-only. */
export function isBuiltInActive(store: TextEndpointPresetStore): boolean {
  return store.activeId === DEFAULT_TEXT_PRESET_ID || !store.presets.some((p) => p.id === store.activeId);
}

/** The active preset's values. The Default built-in (or a ghost id) resolves to the shipped defaults; a
 *  user preset returns its stored snapshot layered over the defaults so a missing future key falls back. */
export function activeValues(store: TextEndpointPresetStore): TextEndpointValues {
  if (isBuiltInActive(store)) return DEFAULT_TEXT_ENDPOINT_VALUES;
  const preset = store.presets.find((p) => p.id === store.activeId);
  return preset ? { ...DEFAULT_TEXT_ENDPOINT_VALUES, ...preset.values } : DEFAULT_TEXT_ENDPOINT_VALUES;
}

export function setActive(store: TextEndpointPresetStore, id: string): TextEndpointPresetStore {
  return { ...store, activeId: id };
}

/** Add a user preset (a copy of `values`) and select it. */
export function addPreset(store: TextEndpointPresetStore, id: string, name: string, values: TextEndpointValues): TextEndpointPresetStore {
  return { activeId: id, presets: [...store.presets, { id, name, values: { ...values } }] };
}

export function renamePreset(store: TextEndpointPresetStore, id: string, name: string): TextEndpointPresetStore {
  return { ...store, presets: store.presets.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/** Remove a user preset; if it was active, fall back to the Default built-in. */
export function deletePreset(store: TextEndpointPresetStore, id: string): TextEndpointPresetStore {
  return {
    activeId: store.activeId === id ? DEFAULT_TEXT_PRESET_ID : store.activeId,
    presets: store.presets.filter((p) => p.id !== id),
  };
}

/** Reset a user preset's values back to the built-in defaults. No-op under the Default built-in. */
export function resetPreset(store: TextEndpointPresetStore, id: string): TextEndpointPresetStore {
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === id ? { ...p, values: { ...DEFAULT_TEXT_ENDPOINT_VALUES } } : p)),
  };
}

/** Patch one value on the active preset. No-op when the Default built-in is active (it's read-only). */
export function updateValue<K extends TextEndpointValueKey>(store: TextEndpointPresetStore, key: K, value: TextEndpointValues[K]): TextEndpointPresetStore {
  if (isBuiltInActive(store)) return store;
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === store.activeId ? { ...p, values: { ...p.values, [key]: value } } : p)),
  };
}
