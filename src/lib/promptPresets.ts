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

/** A named, user-managed set of prompt text. `default` is virtual (the shipped defaults) and never stored. */
export interface PromptPreset {
  id: string;
  name: string;
  values: PromptValues;
}

export interface PromptPresetStore {
  activeId: string;
  presets: PromptPreset[];
}

/** The built-in preset id — its values come from the shipped defaults and can't be edited/renamed/deleted. */
export const DEFAULT_PRESET_ID = 'default';

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

export function isDefaultActive(store: PromptPresetStore): boolean {
  return store.activeId === DEFAULT_PRESET_ID || !store.presets.some((p) => p.id === store.activeId);
}

/** The active preset's values, layered over `defaults` so a preset missing a (future) key falls back cleanly. */
export function activeValues(store: PromptPresetStore, defaults: PromptValues): PromptValues {
  if (isDefaultActive(store)) return defaults;
  const preset = store.presets.find((p) => p.id === store.activeId);
  return preset ? { ...defaults, ...preset.values } : defaults;
}

export function setActive(store: PromptPresetStore, id: string): PromptPresetStore {
  return { ...store, activeId: id };
}

/** Add a preset (a copy of `values`) and select it. */
export function addPreset(store: PromptPresetStore, id: string, name: string, values: PromptValues): PromptPresetStore {
  return { activeId: id, presets: [...store.presets, { id, name, values: { ...values } }] };
}

export function renamePreset(store: PromptPresetStore, id: string, name: string): PromptPresetStore {
  return { ...store, presets: store.presets.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/** Remove a preset; if it was active, fall back to Default. */
export function deletePreset(store: PromptPresetStore, id: string): PromptPresetStore {
  return {
    activeId: store.activeId === id ? DEFAULT_PRESET_ID : store.activeId,
    presets: store.presets.filter((p) => p.id !== id),
  };
}

/** Reset a preset's whole value-set back to the shipped defaults. */
export function resetPreset(store: PromptPresetStore, id: string, defaults: PromptValues): PromptPresetStore {
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === id ? { ...p, values: { ...defaults } } : p)),
  };
}

/** Patch one value on the active preset. No-op when Default is active (it's read-only). */
export function updateValue(store: PromptPresetStore, key: PromptTextKey, value: string): PromptPresetStore {
  if (isDefaultActive(store)) return store;
  return {
    ...store,
    presets: store.presets.map((p) => (p.id === store.activeId ? { ...p, values: { ...p.values, [key]: value } } : p)),
  };
}
