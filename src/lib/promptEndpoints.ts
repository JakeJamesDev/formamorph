import type { AIRequestType } from '@/types';
import {
  DEFAULT_TEXT_PRESET_ID, BUILTIN_ENGINE_PRESET_ID, BUILTIN_ENGINE_VALUES,
  isBuiltInPresetId, valuesForId,
  type TextEndpointPresetStore, type TextEndpointValues,
} from './textEndpointPresets';

/**
 * Which text-endpoint preset each prompt kind sends to, keyed by request type. A kind with no entry
 * follows whatever endpoint preset is active, which is how every prompt behaved before routing existed.
 * Carried on a prompt preset (see `PromptPreset.promptEndpoints`) but never shared with one: the ids name
 * endpoint presets, which mean nothing on the recipient's machine.
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

/** The globally-active endpoint state an unpinned kind resolves to. */
export interface ActiveEndpointState {
  /** The active preset's id, so an unpinned kind reports what it actually resolved to. */
  activeId: string;
  values: TextEndpointValues;
  isBuiltIn: boolean;
  localEngine: boolean;
  /** The active max-output cap, which honors the desktop engine's separate local cap. */
  maxTokens: number;
  /** The bundled engine's own output cap, used whenever the engine is the resolved target. */
  engineMaxTokens: number;
}

/**
 * Whether `id` names a preset this store can route to. The built-in Default always resolves; a user preset
 * only while it exists, so an id left behind by a deleted preset falls back to Use Active Endpoint.
 */
export function isRoutableId(store: TextEndpointPresetStore, id: string | undefined): boolean {
  if (!id) return false;
  return isBuiltInPresetId(id) || store.presets.some((p) => p.id === id);
}

/** The preset a kind routes to, or null for Use Active Endpoint. Ghost ids (deleted preset) read as unpinned. */
export function routedPresetId(kind: AIRequestType, map: PromptEndpointMap, store: TextEndpointPresetStore): string | null {
  const id = map[kind];
  return isRoutableId(store, id) ? (id as string) : null;
}

/**
 * The endpoint a prompt kind sends to. An unpinned (or ghost-pinned) kind returns the active state
 * untouched, so nothing about the pre-routing path changes. A pinned kind returns its preset's values
 * layered over the shipped defaults, so a preset stored before a new field existed still resolves.
 *
 * `localEngine` is a property of the RESOLVED target, not a global mode: it is true exactly when the target
 * is the bundled-engine preset. That is what lets one prompt run on the engine while the rest go outward.
 */
export function resolvePromptEndpoint(
  kind: AIRequestType,
  map: PromptEndpointMap,
  store: TextEndpointPresetStore,
  active: ActiveEndpointState,
): ResolvedPromptEndpoint {
  const routed = routedPresetId(kind, map, store);
  // An unpinned kind resolves to whatever the active selection is, reported under that preset's own id.
  const id = routed ?? active.activeId;

  if (id === BUILTIN_ENGINE_PRESET_ID) {
    const e = BUILTIN_ENGINE_VALUES;
    return {
      presetId: routed,
      endpoint: e.endpoint,
      apiToken: e.apiToken,
      model: e.model,
      // The engine's own cap, whether it was pinned to or merely selected.
      maxTokens: active.engineMaxTokens,
      contextWindowOverride: e.contextWindowOverride,
      isBuiltIn: true,
      localEngine: true,
    };
  }
  if (routed === null) {
    return {
      presetId: null,
      endpoint: active.values.endpoint,
      apiToken: active.values.apiToken,
      model: active.values.model,
      maxTokens: active.maxTokens,
      contextWindowOverride: active.values.contextWindowOverride,
      isBuiltIn: active.isBuiltIn,
      localEngine: false,
    };
  }
  const values = valuesForId(store, routed);
  return {
    presetId: routed,
    endpoint: values.endpoint,
    apiToken: values.apiToken,
    model: values.model,
    maxTokens: values.maxTokens,
    contextWindowOverride: values.contextWindowOverride,
    isBuiltIn: routed === DEFAULT_TEXT_PRESET_ID,
    localEngine: false,
  };
}

/** How a request's endpoint is described in the AI-context viewer. Carries no credential by construction. */
export interface DebugEndpointInfo {
  /** The endpoint preset this resolved to, pinned or followed. */
  preset: string;
  /** True when the prompt was pinned rather than following the active selection. */
  routed: boolean;
  model: string;
  url: string;
}

/**
 * Describe a resolved target for the AI-context viewer. Takes the whole resolved target — token included —
 * and deliberately drops the token: the viewer exports this structure as JSON for bug reports, so the
 * omission is the point of the function rather than an accident of the call site.
 */
export function toDebugEndpoint(target: {
  presetId: string | null;
  presetName: string;
  model: string;
  url: string;
  apiToken: string;
}): DebugEndpointInfo {
  return { preset: target.presetName, routed: target.presetId !== null, model: target.model, url: target.url };
}

/** Cache/probe key for a resolved target, matching the `endpoint|model` signature the reasoning cache uses. */
export function endpointSignature(endpoint: string, model: string): string {
  return `${endpoint}|${model}`;
}

/** Pin a kind to a preset, or clear it back to Use Active Endpoint with a null id. */
export function setPromptEndpoint(map: PromptEndpointMap, kind: AIRequestType, id: string | null): PromptEndpointMap {
  if (id === null) {
    const next = { ...map };
    delete next[kind];
    return next;
  }
  return { ...map, [kind]: id };
}

