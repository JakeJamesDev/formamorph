import type { AIRequestType } from '@/types';
import type { Codec } from './usePersistentState';
import {
  DEFAULT_TEXT_PRESET_ID, DEFAULT_TEXT_ENDPOINT_VALUES,
  type TextEndpointPresetStore, type TextEndpointValues,
} from './textEndpointPresets';

/**
 * Which text-endpoint preset each prompt kind sends to, keyed by request type. A kind with no entry
 * follows whatever preset is globally active, which is how every prompt behaved before routing existed.
 * Persisted globally rather than inside a prompt preset: presets are shareable, and a shared one naming
 * the author's endpoint presets would mean nothing on the recipient's machine.
 */
export type PromptEndpointMap = Partial<Record<AIRequestType, string>>;

/** What a resolved prompt actually sends with, plus the two engine flags the request body branches on. */
export interface ResolvedPromptEndpoint {
  /** The preset this kind is pinned to, or null when it follows the active selection. */
  presetId: string | null;
  endpoint: string;
  apiToken: string;
  model: string;
  maxTokens: number;
  /** Manual context-window override on the resolved preset; null = detect or fall back. */
  contextWindowOverride: number | null;
  /** The resolved target is the built-in Default. */
  isBuiltIn: boolean;
  /** Send the desktop bundled engine's body shape (top_p/top_k/min_p, token-budget reasoning). */
  localEngine: boolean;
}

/** The globally-active endpoint state a Follow-Active kind resolves to. */
export interface ActiveEndpointState {
  values: TextEndpointValues;
  isBuiltIn: boolean;
  localEngine: boolean;
  /** The active max-output cap, which honors the desktop engine's separate local cap. */
  maxTokens: number;
}

/**
 * Whether `id` names a preset this store can route to. The built-in Default always resolves; a user preset
 * only while it exists, so an id left behind by a deleted preset falls back to Follow Active.
 */
export function isRoutableId(store: TextEndpointPresetStore, id: string | undefined): boolean {
  if (!id) return false;
  return id === DEFAULT_TEXT_PRESET_ID || store.presets.some((p) => p.id === id);
}

/** The preset a kind routes to, or null for Follow Active. Ghost ids (deleted preset) read as unpinned. */
export function routedPresetId(kind: AIRequestType, map: PromptEndpointMap, store: TextEndpointPresetStore): string | null {
  const id = map[kind];
  return isRoutableId(store, id) ? (id as string) : null;
}

/**
 * The endpoint a prompt kind sends to. An unpinned (or ghost-pinned) kind returns the active state
 * untouched, so nothing about the pre-routing path changes. A pinned kind returns its preset's values
 * layered over the shipped defaults, so a preset stored before a new field existed still resolves.
 *
 * `localEngine` stays false for a user preset — pinning to one is by definition pointing at an outside
 * server, even on desktop with the bundled engine running. Pinning to Default keeps the global flag,
 * because on desktop the Default endpoint *is* the bundled engine.
 */
export function resolvePromptEndpoint(
  kind: AIRequestType,
  map: PromptEndpointMap,
  store: TextEndpointPresetStore,
  active: ActiveEndpointState,
): ResolvedPromptEndpoint {
  const id = routedPresetId(kind, map, store);
  if (id === null) {
    return {
      presetId: null,
      endpoint: active.values.endpoint,
      apiToken: active.values.apiToken,
      model: active.values.model,
      maxTokens: active.maxTokens,
      contextWindowOverride: active.values.contextWindowOverride,
      isBuiltIn: active.isBuiltIn,
      localEngine: active.localEngine,
    };
  }
  if (id === DEFAULT_TEXT_PRESET_ID) {
    const d = DEFAULT_TEXT_ENDPOINT_VALUES;
    return {
      presetId: id,
      endpoint: d.endpoint,
      apiToken: d.apiToken,
      model: d.model,
      // The desktop engine's own output cap wins whenever it is the thing being addressed.
      maxTokens: active.localEngine ? active.maxTokens : d.maxTokens,
      contextWindowOverride: d.contextWindowOverride,
      isBuiltIn: true,
      localEngine: active.localEngine,
    };
  }
  const preset = store.presets.find((p) => p.id === id);
  const values: TextEndpointValues = { ...DEFAULT_TEXT_ENDPOINT_VALUES, ...preset?.values };
  return {
    presetId: id,
    endpoint: values.endpoint,
    apiToken: values.apiToken,
    model: values.model,
    maxTokens: values.maxTokens,
    contextWindowOverride: values.contextWindowOverride,
    isBuiltIn: false,
    localEngine: false,
  };
}

/** Cache/probe key for a resolved target, matching the `endpoint|model` signature the reasoning cache uses. */
export function endpointSignature(endpoint: string, model: string): string {
  return `${endpoint}|${model}`;
}

/** Drop entries pointing at `id`, so deleting a preset leaves the kinds that used it on Follow Active. */
export function dropPreset(map: PromptEndpointMap, id: string): PromptEndpointMap {
  const next: PromptEndpointMap = {};
  for (const [kind, presetId] of Object.entries(map) as [AIRequestType, string][]) {
    if (presetId !== id) next[kind] = presetId;
  }
  return next;
}

/** Pin a kind to a preset, or clear it back to Follow Active with a null id. */
export function setPromptEndpoint(map: PromptEndpointMap, kind: AIRequestType, id: string | null): PromptEndpointMap {
  if (id === null) {
    const next = { ...map };
    delete next[kind];
    return next;
  }
  return { ...map, [kind]: id };
}

/** localStorage codec; malformed storage falls back to an empty map (every kind follows the active preset). */
export const promptEndpointMapCodec: Codec<PromptEndpointMap> = {
  parse: (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: PromptEndpointMap = {};
      for (const [kind, id] of Object.entries(parsed)) {
        if (typeof id === 'string' && id) out[kind as AIRequestType] = id;
      }
      return out;
    } catch {
      return {};
    }
  },
  serialize: (v) => JSON.stringify(v),
};
