import type { Codec } from './usePersistentState';
import type { AIRequestType } from '@/types';
import type { PromptSamplerMap } from './promptSamplers';
import type { PromptReasoning } from './reasoningEffort';

/** Per-request verbatim-turn overrides carried on a preset; a missing kind uses its shipped default. */
export type VerbatimMap = Partial<Record<AIRequestType, number>>;
/** Per-request reasoning overrides carried on a preset (narration/choices only are user-editable). */
export type ReasoningMap = Record<string, PromptReasoning>;
/** Per-request reasoning-budget overrides (percent of max output; local engine only). A missing kind uses
 *  its shipped default. Narration/choices only are user-editable. */
export type ReasoningBudgetMap = Partial<Record<AIRequestType, number>>;

/** The editable prompt-text values a preset captures: the 11 system-prompt bodies + 5 user-message
 *  templates. Enable flags, verbatim-turns, and thinking mode are global and deliberately NOT included. */
export const PROMPT_TEXT_KEYS = [
  'systemPrompt',
  'narrationUserPrompt',
  'choicesPrompt',
  'statUpdatesPrompt',
  'locationChangePromptText',
  'thinkingPrompt',
  'summaryPrompt',
  'diaryPrompt',
  'directorPrompt',
  'directorUserPrompt',
  'characterPrompt',
  'storyboardPrompt',
  'choicesUserPrompt',
  'statUpdatesUserPrompt',
  'locationChangeUserPrompt',
  'summaryUserPrompt',
] as const;

export type PromptTextKey = (typeof PROMPT_TEXT_KEYS)[number];
export type PromptValues = Record<PromptTextKey, string>;

/** The section-header formatting a preset renders in: `markdown` (`## Foo`) or `labels` (`FOO:`). The
 *  bodies are shared; only the header decoration differs (see src/lib/sectionStyle.ts). */
export type SectionStyle = 'markdown' | 'labels' | 'xml';

/** A named set of prompt text. Built-ins are virtual (derived from the shipped canonical, never stored);
 *  a user preset stores a full value snapshot plus the section style it was authored in. */
export interface PromptPreset {
  id: string;
  name: string;
  values: PromptValues;
  style?: SectionStyle; // absent on legacy presets → treated as 'markdown'
  // Preset-scoped tuning (user presets only; built-ins always use shipped defaults). Absent → defaults.
  samplers?: PromptSamplerMap;
  reasoning?: ReasoningMap;
  reasoningBudget?: ReasoningBudgetMap;
  verbatim?: VerbatimMap;
}

/** The persisted preset state: the currently selected preset plus every user-saved one (built-ins are virtual). */
export interface PromptPresetStore {
  activeId: string;
  presets: PromptPreset[];
}

/** The read-only built-in presets — same content, different section style. Order = dropdown order. */
export const BUILTIN_PRESETS: { id: string; name: string; style: SectionStyle }[] = [
  { id: 'default', name: 'Default', style: 'markdown' },
  { id: 'simple', name: 'Simple', style: 'labels' },
  { id: 'xml', name: 'XML', style: 'xml' },
];

const BUILTIN_IDS = new Set(BUILTIN_PRESETS.map((b) => b.id));

/** The initial/default built-in id (also the sole preset id before styles existed — kept for back-compat). */
export const DEFAULT_PRESET_ID = 'default';

/** The initial store: no user presets, Default built-in active. */
export const emptyStore: PromptPresetStore = { activeId: DEFAULT_PRESET_ID, presets: [] };

/** localStorage codec for the whole store; any malformed value falls back to the empty (Default-only) store. */
export const presetStoreCodec: Codec<PromptPresetStore> = {
  parse: (raw) => {
    try {
      const parsed = JSON.parse(raw) as Partial<PromptPresetStore>;
      if (!parsed || typeof parsed.activeId !== 'string' || !Array.isArray(parsed.presets)) return emptyStore;
      return { activeId: parsed.activeId, presets: parsed.presets as PromptPreset[] };
    } catch {
      return emptyStore;
    }
  },
  serialize: (v) => JSON.stringify(v),
};

/** A built-in preset is active when the id is one of the built-ins, or when it's a ghost id (no matching
 *  user preset) — the same defensive fallback the single-Default logic used. Built-ins are read-only. */
export function isBuiltInActive(store: PromptPresetStore): boolean {
  return BUILTIN_IDS.has(store.activeId) || !store.presets.some((p) => p.id === store.activeId);
}

/** The section style the active preset renders in (built-in's style, a user preset's stored style, or
 *  'markdown' for a ghost/legacy preset). */
export function activeStyle(store: PromptPresetStore): SectionStyle {
  const builtin = BUILTIN_PRESETS.find((b) => b.id === store.activeId);
  if (builtin) return builtin.style;
  const preset = store.presets.find((p) => p.id === store.activeId);
  return preset?.style ?? 'markdown';
}

/** The active preset's values. A built-in (or ghost id) resolves from `builtinValues` by id; a user preset
 *  returns its stored snapshot, layered over the default built-in so a preset missing a future key falls
 *  back cleanly. */
export function activeValues(store: PromptPresetStore, builtinValues: Record<string, PromptValues>): PromptValues {
  const base = builtinValues[DEFAULT_PRESET_ID];
  if (isBuiltInActive(store)) return builtinValues[store.activeId] ?? base;
  const preset = store.presets.find((p) => p.id === store.activeId);
  return preset ? { ...base, ...preset.values } : base;
}

/** Select a preset by id (no validation that it exists — a ghost id falls back to a built-in when read). */
export function setActive(store: PromptPresetStore, id: string): PromptPresetStore {
  return { ...store, activeId: id };
}

/** Add a preset (a copy of `values` in `style`) and select it. */
export function addPreset(store: PromptPresetStore, id: string, name: string, values: PromptValues, style: SectionStyle): PromptPresetStore {
  return { activeId: id, presets: [...store.presets, { id, name, values: { ...values }, style }] };
}

/** Add a full preset (name + values + style + optional tuning, e.g. an import) and select it. */
export function addFullPreset(store: PromptPresetStore, id: string, preset: Omit<PromptPreset, 'id'>): PromptPresetStore {
  return { activeId: id, presets: [...store.presets, { id, ...preset }] };
}

/** Overwrite an existing preset's whole content (name/values/style/tuning) and select it. */
export function replacePreset(store: PromptPresetStore, id: string, preset: Omit<PromptPreset, 'id'>): PromptPresetStore {
  return { activeId: id, presets: store.presets.map((p) => (p.id === id ? { id, ...preset } : p)) };
}

/** Rename a user preset in place; leaves the active selection unchanged. */
export function renamePreset(store: PromptPresetStore, id: string, name: string): PromptPresetStore {
  return { ...store, presets: store.presets.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/** Remove a preset; if it was active, fall back to the default built-in. */
export function deletePreset(store: PromptPresetStore, id: string): PromptPresetStore {
  return {
    activeId: store.activeId === id ? DEFAULT_PRESET_ID : store.activeId,
    presets: store.presets.filter((p) => p.id !== id),
  };
}

/** Reset a preset's whole value-set back to `values` (the caller supplies them in the preset's own style). */
export function resetPreset(store: PromptPresetStore, id: string, values: PromptValues): PromptPresetStore {
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === id ? { ...p, values: { ...values } } : p)),
  };
}

/** Patch one value on the active preset. No-op when a built-in is active (they're read-only). */
export function updateValue(store: PromptPresetStore, key: PromptTextKey, value: string): PromptPresetStore {
  if (isBuiltInActive(store)) return store;
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === store.activeId ? { ...p, values: { ...p.values, [key]: value } } : p)),
  };
}

// --- Preset-scoped tuning (samplers / reasoning / verbatim) ---
// Built-ins carry no tuning: they resolve to the shipped defaults and their setters no-op, exactly like text.

/** The active preset's sampler overrides (empty for a built-in → every kind resolves to its default). */
export function activeSamplers(store: PromptPresetStore): PromptSamplerMap {
  if (isBuiltInActive(store)) return {};
  return store.presets.find((p) => p.id === store.activeId)?.samplers ?? {};
}

/** The active preset's reasoning overrides (empty for a built-in). */
export function activeReasoning(store: PromptPresetStore): ReasoningMap {
  if (isBuiltInActive(store)) return {};
  return store.presets.find((p) => p.id === store.activeId)?.reasoning ?? {};
}

/** The active preset's verbatim-turn overrides (empty for a built-in). */
export function activeVerbatim(store: PromptPresetStore): VerbatimMap {
  if (isBuiltInActive(store)) return {};
  return store.presets.find((p) => p.id === store.activeId)?.verbatim ?? {};
}

/** The active preset's reasoning-budget overrides (empty for a built-in). */
export function activeReasoningBudget(store: PromptPresetStore): ReasoningBudgetMap {
  if (isBuiltInActive(store)) return {};
  return store.presets.find((p) => p.id === store.activeId)?.reasoningBudget ?? {};
}

/** Apply a patch to the active user preset; no-op under a built-in. */
function patchActivePreset(store: PromptPresetStore, patch: (p: PromptPreset) => PromptPreset): PromptPresetStore {
  if (isBuiltInActive(store)) return store;
  return { ...store, presets: store.presets.map((p) => (p.id === store.activeId ? patch(p) : p)) };
}

/** Replace the active preset's sampler map via a transform (the caller owns the toggle/seed logic). No-op under a built-in. */
export function updateSamplers(store: PromptPresetStore, fn: (m: PromptSamplerMap) => PromptSamplerMap): PromptPresetStore {
  return patchActivePreset(store, (p) => ({ ...p, samplers: fn(p.samplers ?? {}) }));
}

/** Set one kind's reasoning choice on the active preset. No-op under a built-in. */
export function updateReasoning(store: PromptPresetStore, kind: AIRequestType, value: PromptReasoning): PromptPresetStore {
  return patchActivePreset(store, (p) => ({ ...p, reasoning: { ...(p.reasoning ?? {}), [kind]: value } }));
}

/** Set one kind's verbatim-turn count on the active preset. No-op under a built-in. */
export function updateVerbatim(store: PromptPresetStore, kind: AIRequestType, value: number): PromptPresetStore {
  return patchActivePreset(store, (p) => ({ ...p, verbatim: { ...(p.verbatim ?? {}), [kind]: value } }));
}

/** Set one kind's reasoning-budget percent on the active preset. No-op under a built-in. */
export function updateReasoningBudget(store: PromptPresetStore, kind: AIRequestType, value: number): PromptPresetStore {
  return patchActivePreset(store, (p) => ({ ...p, reasoningBudget: { ...(p.reasoningBudget ?? {}), [kind]: value } }));
}

/** One-time migration: fold the (previously global) tuning onto every user preset that lacks it, so switching
 *  to any user preset preserves the pre-refactor behavior. Built-ins keep defaults. Only non-empty categories
 *  are applied, and an existing per-preset value is never overwritten. */
export function foldTuningIntoUserPresets(
  store: PromptPresetStore,
  samplers: PromptSamplerMap,
  reasoning: ReasoningMap,
  verbatim: VerbatimMap,
): PromptPresetStore {
  const hasSamplers = Object.keys(samplers).length > 0;
  const hasReasoning = Object.keys(reasoning).length > 0;
  const hasVerbatim = Object.keys(verbatim).length > 0;
  if (!hasSamplers && !hasReasoning && !hasVerbatim) return store;
  return {
    ...store,
    presets: store.presets.map((p) => ({
      ...p,
      samplers: p.samplers ?? (hasSamplers ? { ...samplers } : undefined),
      reasoning: p.reasoning ?? (hasReasoning ? { ...reasoning } : undefined),
      verbatim: p.verbatim ?? (hasVerbatim ? { ...verbatim } : undefined),
    })),
  };
}
