import type { Codec } from './usePersistentState';
import type { ImageProviderId } from './imageGen';
import { DEFAULT_COMFY_WORKFLOW } from './imageGen/comfyui';
import { NOVELAI_DEFAULTS } from './imageGen/novelai';
import {
  DEFAULT_IMAGE_PROVIDER, DEFAULT_IMAGE_ENDPOINT, DEFAULT_IMAGE_API_TOKEN, DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_POSITIVE, DEFAULT_IMAGE_NEGATIVE, DEFAULT_IMAGE_PORTRAIT_WIDTH, DEFAULT_IMAGE_PORTRAIT_HEIGHT,
  DEFAULT_IMAGE_LANDSCAPE_WIDTH, DEFAULT_IMAGE_LANDSCAPE_HEIGHT, DEFAULT_IMAGE_STEPS, DEFAULT_IMAGE_CFG,
  DEFAULT_IMAGE_SAMPLER, DEFAULT_IMAGE_ADETAILER,
} from '../contexts/settingsDefaults';

/** The full AI Endpoints → Image field set a preset captures (everything except the Tag Prompt sub-tab). */
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
  /** ComfyUI only: the API-format workflow template with %tokens%. */
  workflow: string;
  /** InvokeAI Z-Image only: Qwen3 encoder override (model name/key); blank = auto-pick. */
  invokeEncoder: string;
  /** InvokeAI Z-Image only: FLUX VAE override (model name/key); blank = auto-pick. */
  invokeVae: string;
  /** InvokeAI only: gallery board to file generated images under (board id); blank = Uncategorized. */
  invokeBoard: string;
}

export type ImageEndpointValueKey = keyof ImageEndpointValues;

/** A preset stores only the fields the user changed; the rest read live from its base. */
export interface ImageEndpointPreset {
  id: string;
  name: string;
  overrides: Partial<ImageEndpointValues>;
}

export interface ImageEndpointPresetStore {
  activeId: string;
  presets: ImageEndpointPreset[];
}

/** One VITE_DEFAULT_IMAGE_PRESETS entry, fully resolved. Its id is stable across loads. */
export interface EnvImagePreset {
  id: string;
  name: string;
  values: ImageEndpointValues;
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
  workflow: DEFAULT_COMFY_WORKFLOW,
  invokeEncoder: '',
  invokeVae: '',
  invokeBoard: '',
};

export const DEFAULT_IMAGE_PRESET_ID = 'default';

export const envPresetId = (name: string) => `env:${name}`;

/** Layer a raw JSON entry over the built-in defaults, coercing each field by type (unknown keys ignored). */
function coerceValues(rec: Record<string, unknown>): ImageEndpointValues {
  const d = DEFAULT_IMAGE_ENDPOINT_VALUES;
  const str = (k: string, dflt: string) => (typeof rec[k] === 'string' ? (rec[k] as string) : dflt);
  const num = (k: string, dflt: number) => (typeof rec[k] === 'number' && Number.isFinite(rec[k]) ? (rec[k] as number) : dflt);
  return {
    provider:
      rec.provider === 'openai' ? 'openai'
      : rec.provider === 'comfyui' ? 'comfyui'
      : rec.provider === 'invokeai' ? 'invokeai'
      : rec.provider === 'novelai' ? 'novelai'
      : rec.provider === 'a1111' ? 'a1111'
      : d.provider,
    endpoint: str('endpoint', d.endpoint),
    apiToken: str('apiToken', d.apiToken),
    model: str('model', d.model),
    positivePrompt: str('positivePrompt', d.positivePrompt),
    negativePrompt: str('negativePrompt', d.negativePrompt),
    portraitWidth: num('portraitWidth', d.portraitWidth),
    portraitHeight: num('portraitHeight', d.portraitHeight),
    landscapeWidth: num('landscapeWidth', d.landscapeWidth),
    landscapeHeight: num('landscapeHeight', d.landscapeHeight),
    steps: num('steps', d.steps),
    cfg: num('cfg', d.cfg),
    sampler: str('sampler', d.sampler),
    adetailer: typeof rec.adetailer === 'boolean' ? rec.adetailer : d.adetailer,
    workflow: str('workflow', d.workflow),
    invokeEncoder: str('invokeEncoder', d.invokeEncoder),
    invokeVae: str('invokeVae', d.invokeVae),
    invokeBoard: str('invokeBoard', d.invokeBoard),
  };
}

/**
 * Parse VITE_DEFAULT_IMAGE_PRESETS — a JSON array of `{ name, ...partial values }` entries, each layered
 * over the built-in defaults. Unset or malformed input yields no presets; a repeated name keeps the first.
 */
export function parseEnvPresets(raw: string | undefined): EnvImagePreset[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const presets: EnvImagePreset[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name || presets.some((p) => p.name === name)) continue;
    presets.push({ id: envPresetId(name), name, values: coerceValues(rec) });
  }
  return presets;
}

const ENV_PRESETS = parseEnvPresets(import.meta.env.VITE_DEFAULT_IMAGE_PRESETS);

/** The values a preset falls back to: its env entry when it came from one, else the built-in defaults. */
export function baseValues(id: string, env: EnvImagePreset[] = ENV_PRESETS): ImageEndpointValues {
  return env.find((p) => p.id === id)?.values ?? DEFAULT_IMAGE_ENDPOINT_VALUES;
}

/** The fields of `values` that differ from `base`. */
function diff(values: ImageEndpointValues, base: ImageEndpointValues): Partial<ImageEndpointValues> {
  const out: Partial<Record<ImageEndpointValueKey, unknown>> = {};
  for (const key of Object.keys(values) as ImageEndpointValueKey[]) {
    if (values[key] !== base[key]) out[key] = values[key];
  }
  return out as Partial<ImageEndpointValues>;
}

/** A fresh store holding one editable "Default" preset seeded from `values` (defaults to the built-ins). */
export function makeDefaultStore(values: ImageEndpointValues = DEFAULT_IMAGE_ENDPOINT_VALUES): ImageEndpointPresetStore {
  return {
    activeId: DEFAULT_IMAGE_PRESET_ID,
    presets: [{ id: DEFAULT_IMAGE_PRESET_ID, name: 'Default', overrides: diff(values, DEFAULT_IMAGE_ENDPOINT_VALUES) }],
  };
}

/** A store with one untouched preset per env entry, the first active. Null when there are none. */
export function presetStoreFromEnv(env: EnvImagePreset[] = ENV_PRESETS): ImageEndpointPresetStore | null {
  if (env.length === 0) return null;
  return { activeId: env[0].id, presets: env.map((p) => ({ id: p.id, name: p.name, overrides: {} })) };
}

type StoredPreset = { id: string; name: string; overrides?: Partial<ImageEndpointValues>; values?: Partial<ImageEndpointValues> };

/**
 * Convert presets saved as full value copies into overrides. A copy whose name matches an env entry
 * takes that entry's id, so Reset returns to the env values. Presets already in override form pass through.
 */
export function migrateStore(
  stored: { activeId: string; presets: StoredPreset[] },
  env: EnvImagePreset[] = ENV_PRESETS,
): ImageEndpointPresetStore {
  let activeId = stored.activeId;
  const claimed = new Set(stored.presets.map((p) => p.id));
  const presets = stored.presets.map((p): ImageEndpointPreset => {
    if (p.overrides) return { id: p.id, name: p.name, overrides: p.overrides };
    const full = { ...DEFAULT_IMAGE_ENDPOINT_VALUES, ...p.values };
    const match = env.find((e) => e.name === p.name);
    let id = p.id;
    if (match && !claimed.has(match.id)) {
      claimed.add(match.id);
      if (activeId === id) activeId = match.id;
      id = match.id;
    }
    return { id, name: p.name, overrides: diff(full, baseValues(id, env)) };
  });
  return { activeId, presets };
}

/** localStorage codec; any malformed/empty value falls back to a fresh Default-only store. */
export const imageEndpointPresetCodec: Codec<ImageEndpointPresetStore> = {
  parse: (raw) => {
    try {
      const parsed = JSON.parse(raw) as { activeId?: unknown; presets?: unknown };
      if (!parsed || typeof parsed.activeId !== 'string' || !Array.isArray(parsed.presets) || parsed.presets.length === 0) {
        return makeDefaultStore();
      }
      return migrateStore({ activeId: parsed.activeId, presets: parsed.presets as StoredPreset[] });
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

/** A preset's effective values: its base with the user's overrides on top. */
function presetValues(preset: ImageEndpointPreset | undefined, env: EnvImagePreset[]): ImageEndpointValues {
  return preset ? { ...baseValues(preset.id, env), ...preset.overrides } : DEFAULT_IMAGE_ENDPOINT_VALUES;
}

export function activeValues(store: ImageEndpointPresetStore, env: EnvImagePreset[] = ENV_PRESETS): ImageEndpointValues {
  return presetValues(activePreset(store), env);
}

/** Replace the active preset's values, storing only what differs from its base. */
function setActiveValues(
  store: ImageEndpointPresetStore,
  next: (current: ImageEndpointValues) => ImageEndpointValues,
  env: EnvImagePreset[],
): ImageEndpointPresetStore {
  const active = activePreset(store);
  return {
    ...store,
    presets: store.presets.map((p) =>
      p === active ? { ...p, overrides: diff(next(presetValues(p, env)), baseValues(p.id, env)) } : p,
    ),
  };
}

export function setActive(store: ImageEndpointPresetStore, id: string): ImageEndpointPresetStore {
  return { ...store, activeId: id };
}

/** Add a preset (a copy of `values`) and select it. */
export function addPreset(store: ImageEndpointPresetStore, id: string, name: string, values: ImageEndpointValues): ImageEndpointPresetStore {
  return { activeId: id, presets: [...store.presets, { id, name, overrides: diff(values, DEFAULT_IMAGE_ENDPOINT_VALUES) }] };
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

/** Drop a preset's overrides so it reads its base (the env entry or the built-in defaults) again. */
export function resetPreset(store: ImageEndpointPresetStore, id: string): ImageEndpointPresetStore {
  return { ...store, presets: store.presets.map((p) => (p.id === id ? { ...p, overrides: {} } : p)) };
}

/** Values seeded into a preset the first time it is pointed at a provider that has an opinion about
 *  them. NovelAI's are the settings its free-generation window covers, plus a blank endpoint so a URL
 *  typed for the previous provider doesn't outlive it (blank resolves to NovelAI's host at request time). */
const PROVIDER_SEED: Partial<Record<ImageProviderId, Partial<ImageEndpointValues>>> = {
  novelai: {
    endpoint: '',
    model: NOVELAI_DEFAULTS.model,
    portraitWidth: NOVELAI_DEFAULTS.width,
    portraitHeight: NOVELAI_DEFAULTS.height,
    landscapeWidth: NOVELAI_DEFAULTS.width,
    landscapeHeight: NOVELAI_DEFAULTS.height,
    steps: NOVELAI_DEFAULTS.steps,
  },
};

/** Whether these values already look like a configured preset for `provider`, in which case switching
 *  back to it must not overwrite what the user set. The NovelAI test is by id prefix, not membership in
 *  the hardcoded list, so a model this build doesn't list still counts as configured. */
const isConfiguredFor = (values: ImageEndpointValues, provider: ImageProviderId): boolean =>
  provider === 'novelai' && /^nai-diffusion/.test(values.model);

/** `values` pointed at `provider`, with that provider's seed values applied on a first switch. */
export function providerSwitchValues(values: ImageEndpointValues, provider: ImageProviderId): ImageEndpointValues {
  const seed = PROVIDER_SEED[provider];
  if (!seed || isConfiguredFor(values, provider)) return { ...values, provider };
  return { ...values, ...seed, provider };
}

/** Point the active preset at `provider` (seeding its defaults on a first switch). */
export function setProvider(
  store: ImageEndpointPresetStore, provider: ImageProviderId, env: EnvImagePreset[] = ENV_PRESETS,
): ImageEndpointPresetStore {
  return setActiveValues(store, (v) => providerSwitchValues(v, provider), env);
}

/** Patch one value on the active preset (every preset is editable). */
export function updateValue<K extends ImageEndpointValueKey>(
  store: ImageEndpointPresetStore, key: K, value: ImageEndpointValues[K], env: EnvImagePreset[] = ENV_PRESETS,
): ImageEndpointPresetStore {
  return setActiveValues(store, (v) => ({ ...v, [key]: value }), env);
}
