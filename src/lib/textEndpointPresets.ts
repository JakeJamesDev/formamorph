import { randomUUID } from '@/lib/uuid';
import type { Codec } from './usePersistentState';
import { isDesktop, DEFAULT_LOCAL_LLM_ENDPOINT } from '@/lib/imageGen/desktop';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, HOSTED_ENDPOINT } from '../contexts/settingsDefaults';
import { normalizeEndpointUrl } from './endpointUrl';
import { HOSTED_CHAT_URL } from './hostedAi/hostedUrls';
import {
  coerceEndpointSamplerOverrides,
  coerceEndpointMaxOutputOverride,
  defaultEndpointSamplerOverrides,
  hostedEndpointSamplerOverrides,
  type EndpointSampler,
  type EndpointMaxOutputOverride,
  type EndpointSamplerOverride,
  type EndpointSamplerOverrides,
} from './endpointSamplers';

/** The custom text-endpoint fields a preset captures. */
export interface TextEndpointValues {
  endpoint: string;
  apiToken: string;
  model: string;
  /** Manual context-window override; null = use the auto-detected value. */
  contextWindowOverride: number | null;
  maxOutputOverride: EndpointMaxOutputOverride;
  samplerOverrides: EndpointSamplerOverrides;
  /** Extra Parameters: a JSON object merged into every request body to this endpoint (lib/extraParams). */
  extraParams?: string;
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
  /** Tuning for the virtual hosted Default, whose connection fields remain immutable. */
  defaultSamplerOverrides?: EndpointSamplerOverrides;
  /** Legacy shared-endpoint value retained but ignored for the fixed cap. */
  defaultMaxOutputOverride?: EndpointMaxOutputOverride;
  /** The player's Formamorph AI sampler tuning; absent means the model's published values. */
  hostedSamplerOverrides?: EndpointSamplerOverrides;
  /** The player's Formamorph AI max output; absent means the shipped default. The sent value never passes the server's cap. */
  hostedMaxTokens?: number;
}

/** The read-only "Default" preset — the shipped/embedded shared endpoint. Selecting it = "use our endpoint". */
export const DEFAULT_TEXT_PRESET_ID = 'default';

/**
 * The desktop bundled engine, as an endpoint like any other. Modeling it as a preset rather than a mode is
 * what lets a single prompt be routed to it while the rest go elsewhere — a mode is global by construction.
 * Desktop only; absent from the list on web, where there is no engine to run.
 */
export const BUILTIN_ENGINE_PRESET_ID = 'builtin-engine';

/** The engine's fixed connection. Its context window and output cap are NOT here: they're the engine's own
 *  load settings (localContextSize / localMaxTokens), supplied by the caller at resolve time. The model name
 *  is nominal — the engine serves whatever GGUF is loaded regardless of what the request asks for. */
export const BUILTIN_ENGINE_VALUES: TextEndpointValues = {
  endpoint: DEFAULT_LOCAL_LLM_ENDPOINT,
  apiToken: '',
  model: 'default',
  contextWindowOverride: null,
  maxOutputOverride: { enabled: true, value: DEFAULT_MAX_TOKENS },
  samplerOverrides: defaultEndpointSamplerOverrides(),
};

/** Formamorph AI, the endpoint for Supporters. Its window, model and capabilities come from the hosted state. */
export const FORMAMORPH_AI_PRESET_ID = 'formamorph-ai';

/** Formamorph AI's fixed connection. The model name is nominal: the server picks the model. Its samplers and
 *  max output are the shipped starting point; the store holds the player's changes. */
export const FORMAMORPH_AI_VALUES: TextEndpointValues = {
  endpoint: HOSTED_CHAT_URL,
  apiToken: '',
  model: 'formamorph-ai',
  contextWindowOverride: null,
  maxOutputOverride: { enabled: true, value: DEFAULT_MAX_TOKENS },
  samplerOverrides: hostedEndpointSamplerOverrides(),
};

/** Whether an endpoint URL is the hosted service, in either the base or the completed spelling. */
export function isHostedEndpoint(endpoint: string): boolean {
  return normalizeEndpointUrl(endpoint) === normalizeEndpointUrl(HOSTED_ENDPOINT);
}

/** The preset a stored id resolves to. A ghost id reads as the Default preset, whose values it gets. */
export function canonicalPresetId(store: TextEndpointPresetStore, id: string): string {
  return isBuiltInPresetId(id) || store.presets.some((p) => p.id === id) ? id : DEFAULT_TEXT_PRESET_ID;
}

/** Whether a resolved endpoint is the Demo AI: the Default preset on the hosted service, never a user preset. */
export function isDemoAI(resolved: { endpointId: string; endpoint: string }): boolean {
  return resolved.endpointId === DEFAULT_TEXT_PRESET_ID && isHostedEndpoint(resolved.endpoint);
}

/** The Default preset's display name: the Demo AI on the hosted service, "Default" on a build that overrides it. */
export function defaultPresetName(): string {
  return isDemoAI({ endpointId: DEFAULT_TEXT_PRESET_ID, endpoint: DEFAULT_ENDPOINT }) ? 'Demo AI' : 'Default';
}

/** The read-only presets available on this platform, in dropdown order. */
export function builtinTextPresets(): { id: string; name: string }[] {
  const defaultPreset = { id: DEFAULT_TEXT_PRESET_ID, name: defaultPresetName() };
  // A build with no community server has no proxy to reach.
  const hosted = HOSTED_CHAT_URL ? [{ id: FORMAMORPH_AI_PRESET_ID, name: 'Formamorph AI' }] : [];
  return isDesktop()
    ? [{ id: BUILTIN_ENGINE_PRESET_ID, name: 'Built-In Engine' }, defaultPreset, ...hosted]
    : [defaultPreset, ...hosted];
}

/** Whether `id` names Formamorph AI on this build. */
export function isFormamorphAiId(id: string): boolean {
  return id === FORMAMORPH_AI_PRESET_ID && HOSTED_CHAT_URL !== '';
}

/** A preset's display name. A ghost id takes the Default preset's name, as it resolves to the Default values. */
export function textPresetName(store: TextEndpointPresetStore, id: string): string {
  return builtinTextPresets().find((b) => b.id === id)?.name
    ?? store.presets.find((p) => p.id === id)?.name
    ?? defaultPresetName();
}

/** Whether `id` is one of the read-only built-ins on this platform. */
export function isBuiltInPresetId(id: string): boolean {
  return builtinTextPresets().some((b) => b.id === id);
}

/** The Default preset's values: the built-in shared endpoint (honors VITE_DEFAULT_* via settingsDefaults). */
export const DEFAULT_TEXT_ENDPOINT_VALUES: TextEndpointValues = {
  endpoint: DEFAULT_ENDPOINT,
  apiToken: DEFAULT_API_TOKEN,
  model: DEFAULT_MODEL_NAME,
  contextWindowOverride: null,
  maxOutputOverride: { enabled: true, value: DEFAULT_MAX_TOKENS },
  samplerOverrides: defaultEndpointSamplerOverrides(),
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
    maxOutputOverride: coerceEndpointMaxOutputOverride(rec.maxOutputOverride, num('maxTokens', d.maxOutputOverride.value)),
    samplerOverrides: coerceEndpointSamplerOverrides(rec.samplerOverrides),
    ...(typeof rec.extraParams === 'string' && rec.extraParams.trim() && { extraParams: rec.extraParams }),
  };
}

/** Environment presets seed a fresh configuration, so they retain values but never activate overrides. */
function coerceFreshValues(rec: Record<string, unknown>): TextEndpointValues {
  const values = coerceValues(rec);
  return { ...values, maxOutputOverride: { ...values.maxOutputOverride, enabled: false } };
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
    presets.push({ id: randomUUID(), name, values: coerceFreshValues(rec) });
  }
  if (presets.length === 0) return null;
  return { activeId: presets[0].id, presets };
}

function positiveInt(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : undefined;
}

/** localStorage codec; any malformed value falls back to the empty (Default-only) store. */
export const textEndpointPresetCodec: Codec<TextEndpointPresetStore> = {
  parse: (raw) => {
    try {
      const parsed = JSON.parse(raw) as Partial<TextEndpointPresetStore>;
      if (!parsed || typeof parsed.activeId !== 'string' || !Array.isArray(parsed.presets)) return emptyStore;
      const presets = parsed.presets.flatMap((preset): TextEndpointPreset[] => {
        if (!preset || typeof preset !== 'object') return [];
        const record = preset as unknown as Record<string, unknown>;
        if (typeof record.id !== 'string' || typeof record.name !== 'string' || !record.values || typeof record.values !== 'object') return [];
        return [{ id: record.id, name: record.name, values: coerceValues(record.values as Record<string, unknown>) }];
      });
      const defaultSamplerOverrides = coerceEndpointSamplerOverrides(parsed.defaultSamplerOverrides);
      const legacyStore = parsed as Partial<TextEndpointPresetStore> & { defaultMaxTokens?: unknown };
      const defaultMaxOutputOverride = coerceEndpointMaxOutputOverride(
        parsed.defaultMaxOutputOverride,
        typeof legacyStore.defaultMaxTokens === 'number' && Number.isFinite(legacyStore.defaultMaxTokens)
          ? legacyStore.defaultMaxTokens
          : DEFAULT_TEXT_ENDPOINT_VALUES.maxOutputOverride.value,
      );
      const hostedMaxTokens = positiveInt(parsed.hostedMaxTokens);
      return {
        activeId: parsed.activeId,
        presets,
        defaultSamplerOverrides,
        defaultMaxOutputOverride,
        ...(parsed.hostedSamplerOverrides !== undefined && {
          hostedSamplerOverrides: coerceEndpointSamplerOverrides(parsed.hostedSamplerOverrides, hostedEndpointSamplerOverrides()),
        }),
        ...(hostedMaxTokens !== undefined && { hostedMaxTokens }),
      };
    } catch {
      return emptyStore;
    }
  },
  serialize: (v) => JSON.stringify(v),
};

/** A built-in is active when the id names one, or when it's a ghost id (no matching user preset) — a
 *  defensive fallback. Built-ins are read-only. */
export function isBuiltInActive(store: TextEndpointPresetStore): boolean {
  return isBuiltInPresetId(store.activeId) || !store.presets.some((p) => p.id === store.activeId);
}

/** Whether the bundled desktop engine is the active endpoint. */
export function isEngineActive(store: TextEndpointPresetStore): boolean {
  return store.activeId === BUILTIN_ENGINE_PRESET_ID && isDesktop();
}

/** The values behind a preset id: either built-in, or a user preset layered over the shipped defaults so a
 *  preset missing a future key falls back cleanly. An unknown id resolves to Default. */
export function valuesForId(store: TextEndpointPresetStore, id: string): TextEndpointValues {
  if (id === BUILTIN_ENGINE_PRESET_ID) return BUILTIN_ENGINE_VALUES;
  if (isFormamorphAiId(id)) return {
    ...FORMAMORPH_AI_VALUES,
    maxOutputOverride: { enabled: true, value: store.hostedMaxTokens ?? FORMAMORPH_AI_VALUES.maxOutputOverride.value },
    samplerOverrides: coerceEndpointSamplerOverrides(store.hostedSamplerOverrides, hostedEndpointSamplerOverrides()),
  };
  if (id === DEFAULT_TEXT_PRESET_ID) return {
    ...DEFAULT_TEXT_ENDPOINT_VALUES,
    samplerOverrides: coerceEndpointSamplerOverrides(store.defaultSamplerOverrides),
  };
  const preset = store.presets.find((p) => p.id === id);
  return preset ? {
    ...DEFAULT_TEXT_ENDPOINT_VALUES,
    ...preset.values,
    samplerOverrides: coerceEndpointSamplerOverrides(preset.values.samplerOverrides),
  } : valuesForId(store, DEFAULT_TEXT_PRESET_ID);
}

/** The active preset's values. A ghost id lands on Default, the same defensive fallback as before. */
export function activeValues(store: TextEndpointPresetStore): TextEndpointValues {
  return valuesForId(store, store.activeId);
}

export function setActive(store: TextEndpointPresetStore, id: string): TextEndpointPresetStore {
  return { ...store, activeId: id };
}

/** Add a user preset (a copy of `values`), and select it unless `select` is false. */
export function addPreset(
  store: TextEndpointPresetStore, id: string, name: string, values: TextEndpointValues, { select = true }: { select?: boolean } = {},
): TextEndpointPresetStore {
  return {
    ...store,
    activeId: select ? id : store.activeId,
    presets: [...store.presets, { id, name, values: { ...values, samplerOverrides: coerceEndpointSamplerOverrides(values.samplerOverrides) } }],
  };
}

export function renamePreset(store: TextEndpointPresetStore, id: string, name: string): TextEndpointPresetStore {
  return { ...store, presets: store.presets.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/** Remove a user preset; if it was active, fall back to the Default built-in. */
export function deletePreset(store: TextEndpointPresetStore, id: string): TextEndpointPresetStore {
  return {
    ...store,
    activeId: store.activeId === id ? DEFAULT_TEXT_PRESET_ID : store.activeId,
    presets: store.presets.filter((p) => p.id !== id),
  };
}

/** Reset a user preset's values back to the built-in defaults. No-op under the Default built-in. */
export function resetPreset(store: TextEndpointPresetStore, id: string): TextEndpointPresetStore {
  if (isFormamorphAiId(id)) return resetHostedTuning(store);
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === id ? { ...p, values: { ...DEFAULT_TEXT_ENDPOINT_VALUES } } : p)),
  };
}

/** Return Formamorph AI's samplers and max output to their shipped starting point. */
export function resetHostedTuning(store: TextEndpointPresetStore): TextEndpointPresetStore {
  const { hostedSamplerOverrides: _samplers, hostedMaxTokens: _maxTokens, ...rest } = store;
  return rest;
}

/** Change one external endpoint's sampler state without making its connection fields editable. */
export function updateSamplerOverride(
  store: TextEndpointPresetStore,
  id: string,
  sampler: EndpointSampler,
  override: EndpointSamplerOverride,
): TextEndpointPresetStore {
  if (id === BUILTIN_ENGINE_PRESET_ID) return store;
  if (isFormamorphAiId(id)) {
    const current = valuesForId(store, id).samplerOverrides;
    return { ...store, hostedSamplerOverrides: { ...current, [sampler]: override } };
  }
  const current = id === DEFAULT_TEXT_PRESET_ID
    ? coerceEndpointSamplerOverrides(store.defaultSamplerOverrides)
    : coerceEndpointSamplerOverrides(store.presets.find((preset) => preset.id === id)?.values.samplerOverrides);
  const samplerOverrides = { ...current, [sampler]: override };
  if (id === DEFAULT_TEXT_PRESET_ID) return { ...store, defaultSamplerOverrides: samplerOverrides };
  return {
    ...store,
    presets: store.presets.map((preset) => preset.id === id
      ? { ...preset, values: { ...preset.values, samplerOverrides } }
      : preset),
  };
}

/** Change a user endpoint's output limit without changing its remembered number. */
export function updateMaxOutputOverride(
  store: TextEndpointPresetStore,
  id: string,
  override: EndpointMaxOutputOverride,
): TextEndpointPresetStore {
  if (id === BUILTIN_ENGINE_PRESET_ID || id === DEFAULT_TEXT_PRESET_ID) return store;
  // Formamorph AI always sends a cap, so only its number changes.
  if (isFormamorphAiId(id)) return { ...store, hostedMaxTokens: override.value };
  return {
    ...store,
    presets: store.presets.map((preset) => (preset.id === id
      ? { ...preset, values: { ...preset.values, maxOutputOverride: override } }
      : preset)),
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

/**
 * Apply a change to the preset `id` names, active or not. The change reads that preset's current values. The
 * built-ins keep their connection fields: the Default takes only sampler changes, the engine and Formamorph AI none.
 */
export function editPreset(
  store: TextEndpointPresetStore,
  id: string,
  change: (values: TextEndpointValues) => Partial<TextEndpointValues>,
): TextEndpointPresetStore {
  if (id === BUILTIN_ENGINE_PRESET_ID) return store;
  const hosted = isFormamorphAiId(id);
  if (!hosted && id !== DEFAULT_TEXT_PRESET_ID && !store.presets.some((p) => p.id === id)) return store;
  const current = valuesForId(store, id);
  const { samplerOverrides, maxOutputOverride, ...fields } = change(current);
  let next = store;
  // Formamorph AI's connection fields stay the account's: only its tuning takes a change.
  if (hosted && maxOutputOverride) next = updateMaxOutputOverride(next, id, maxOutputOverride);
  if (samplerOverrides) {
    for (const sampler of Object.keys(samplerOverrides) as EndpointSampler[]) {
      next = updateSamplerOverride(next, id, sampler, samplerOverrides[sampler]);
    }
  }
  const edits = { ...fields, ...(maxOutputOverride && { maxOutputOverride }) };
  if (hosted || id === DEFAULT_TEXT_PRESET_ID || Object.keys(edits).length === 0) return next;
  return {
    ...next,
    presets: next.presets.map((p) => (p.id === id ? { ...p, values: { ...p.values, ...edits } } : p)),
  };
}
