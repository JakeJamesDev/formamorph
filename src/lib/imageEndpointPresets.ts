import type { Codec } from './usePersistentState';
import type { ImageProviderId } from './imageGen';
import {
  DEFAULT_IMAGE_PROVIDER, DEFAULT_IMAGE_ENDPOINT, DEFAULT_IMAGE_API_TOKEN, DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_POSITIVE, DEFAULT_IMAGE_NEGATIVE, DEFAULT_IMAGE_PORTRAIT_WIDTH, DEFAULT_IMAGE_PORTRAIT_HEIGHT,
  DEFAULT_IMAGE_LANDSCAPE_WIDTH, DEFAULT_IMAGE_LANDSCAPE_HEIGHT, DEFAULT_IMAGE_STEPS, DEFAULT_IMAGE_CFG,
  DEFAULT_IMAGE_SAMPLER, DEFAULT_IMAGE_ADETAILER,
} from '../contexts/settingsDefaults';

/** The full Image Gen → Endpoint field set a preset captures (everything except the Tag Prompt sub-tab). */
export interface ImageEndpointValues {
  provider: ImageProviderId;
  endpoint: string;
  apiToken: string;
  model: string;
  positivePrompt: string;
  negativePrompt: string;
  portraitWidth: number;
  portraitHeight: number;
  landscapeWidth: number;
  landscapeHeight: number;
  steps: number;
  cfg: number;
  sampler: string;
  adetailer: boolean;
}

export type ImageEndpointValueKey = keyof ImageEndpointValues;

export interface ImageEndpointPreset {
  id: string;
  name: string;
  values: ImageEndpointValues;
}

export interface ImageEndpointPresetStore {
  activeId: string;
  presets: ImageEndpointPreset[];
}

/** Built-in defaults for a fresh "Default" preset (honors the VITE_DEFAULT_IMAGE_* overrides). */
export const DEFAULT_IMAGE_ENDPOINT_VALUES: ImageEndpointValues = {
  provider: DEFAULT_IMAGE_PROVIDER as ImageProviderId,
  endpoint: DEFAULT_IMAGE_ENDPOINT,
  apiToken: DEFAULT_IMAGE_API_TOKEN,
  model: DEFAULT_IMAGE_MODEL,
  positivePrompt: DEFAULT_IMAGE_POSITIVE,
  negativePrompt: DEFAULT_IMAGE_NEGATIVE,
  portraitWidth: DEFAULT_IMAGE_PORTRAIT_WIDTH,
  portraitHeight: DEFAULT_IMAGE_PORTRAIT_HEIGHT,
  landscapeWidth: DEFAULT_IMAGE_LANDSCAPE_WIDTH,
  landscapeHeight: DEFAULT_IMAGE_LANDSCAPE_HEIGHT,
  steps: DEFAULT_IMAGE_STEPS,
  cfg: DEFAULT_IMAGE_CFG,
  sampler: DEFAULT_IMAGE_SAMPLER,
  adetailer: DEFAULT_IMAGE_ADETAILER,
};

export const DEFAULT_IMAGE_PRESET_ID = 'default';

/** A fresh store holding one editable "Default" preset seeded from `values` (defaults to the built-ins). */
export function makeDefaultStore(values: ImageEndpointValues = DEFAULT_IMAGE_ENDPOINT_VALUES): ImageEndpointPresetStore {
  return { activeId: DEFAULT_IMAGE_PRESET_ID, presets: [{ id: DEFAULT_IMAGE_PRESET_ID, name: 'Default', values: { ...values } }] };
}

/** localStorage codec; any malformed/empty value falls back to a fresh Default-only store. */
export const imageEndpointPresetCodec: Codec<ImageEndpointPresetStore> = {
  parse: (raw) => {
    try {
      const parsed = JSON.parse(raw) as Partial<ImageEndpointPresetStore>;
      if (!parsed || typeof parsed.activeId !== 'string' || !Array.isArray(parsed.presets) || parsed.presets.length === 0) {
        return makeDefaultStore();
      }
      return { activeId: parsed.activeId, presets: parsed.presets as ImageEndpointPreset[] };
    } catch {
      return makeDefaultStore();
    }
  },
  serialize: (v) => JSON.stringify(v),
};

/** The active preset (falls back to the first when the id is stale). */
function activePreset(store: ImageEndpointPresetStore): ImageEndpointPreset {
  return store.presets.find((p) => p.id === store.activeId) ?? store.presets[0];
}

/** The active preset's values, layered over the built-in defaults so a missing future key falls back. */
export function activeValues(store: ImageEndpointPresetStore): ImageEndpointValues {
  return { ...DEFAULT_IMAGE_ENDPOINT_VALUES, ...activePreset(store)?.values };
}

export function setActive(store: ImageEndpointPresetStore, id: string): ImageEndpointPresetStore {
  return { ...store, activeId: id };
}

/** Add a preset (a copy of `values`) and select it. */
export function addPreset(store: ImageEndpointPresetStore, id: string, name: string, values: ImageEndpointValues): ImageEndpointPresetStore {
  return { activeId: id, presets: [...store.presets, { id, name, values: { ...values } }] };
}

export function renamePreset(store: ImageEndpointPresetStore, id: string, name: string): ImageEndpointPresetStore {
  return { ...store, presets: store.presets.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/** Remove a preset; never drops below one. If the active one is removed, fall back to the first remaining. */
export function deletePreset(store: ImageEndpointPresetStore, id: string): ImageEndpointPresetStore {
  if (store.presets.length <= 1) return store;
  const presets = store.presets.filter((p) => p.id !== id);
  return { activeId: store.activeId === id ? presets[0].id : store.activeId, presets };
}

/** Reset a preset's values back to the built-in defaults. */
export function resetPreset(store: ImageEndpointPresetStore, id: string): ImageEndpointPresetStore {
  return { ...store, presets: store.presets.map((p) => (p.id === id ? { ...p, values: { ...DEFAULT_IMAGE_ENDPOINT_VALUES } } : p)) };
}

/** Patch one value on the active preset (every preset is editable). */
export function updateValue<K extends ImageEndpointValueKey>(store: ImageEndpointPresetStore, key: K, value: ImageEndpointValues[K]): ImageEndpointPresetStore {
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === store.activeId ? { ...p, values: { ...p.values, [key]: value } } : p)),
  };
}
