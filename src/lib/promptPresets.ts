import type { Codec } from './usePersistentState';

/** The editable prompt-text values a preset captures: the 11 system-prompt bodies + 4 user-message
 *  templates. Enable flags, verbatim-turns, and thinking mode are global and deliberately NOT included. */
export const PROMPT_TEXT_KEYS = [
  'systemPrompt',
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
export type SectionStyle = 'markdown' | 'labels';

/** A named set of prompt text. Built-ins are virtual (derived from the shipped canonical, never stored);
 *  a user preset stores a full value snapshot plus the section style it was authored in. */
export interface PromptPreset {
  id: string;
  name: string;
  values: PromptValues;
  style?: SectionStyle; // absent on legacy presets → treated as 'markdown'
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
