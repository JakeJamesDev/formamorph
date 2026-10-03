/**
 * The help preset store: the three help prompts as one named set. The Default preset is read-only and reads
 * its text from the code, so each release updates it for every player who has no custom preset. A custom
 * preset stores its own three texts. The store is a device setting, apart from the gameplay prompt presets.
 */
import { DEFAULT_HELP_PROMPTS, type HelpPromptKey, type HelpPromptTexts } from './helpPrompt';

export interface HelpPreset {
  readonly id: string;
  readonly name: string;
  readonly prompts: HelpPromptTexts;
}

/** The active preset id and every custom preset. The Default preset is virtual, never stored. */
export interface HelpPresetStore {
  readonly activeId: string;
  readonly presets: readonly HelpPreset[];
}

export const DEFAULT_HELP_PRESET_ID = 'default';
export const DEFAULT_HELP_PRESET_NAME = 'Default';

/** The store of a player who has made no preset. */
export const EMPTY_HELP_PRESET_STORE: HelpPresetStore = { activeId: DEFAULT_HELP_PRESET_ID, presets: [] };

/** The Default preset, from the code of this build. */
export const defaultHelpPreset = (): HelpPreset => ({ id: DEFAULT_HELP_PRESET_ID, name: DEFAULT_HELP_PRESET_NAME, prompts: DEFAULT_HELP_PROMPTS });

const customOf = (store: HelpPresetStore, id: string): HelpPreset | undefined => store.presets.find((preset) => preset.id === id);

/** The preset `id` names: a custom preset, else the Default preset, for the Default id or an id no preset holds. */
export function helpPresetOf(store: HelpPresetStore, id: string): HelpPreset {
  return customOf(store, id) ?? defaultHelpPreset();
}

/** The active preset. An active id no preset holds reads as the Default preset. */
export const activeHelpPreset = (store: HelpPresetStore): HelpPreset => helpPresetOf(store, store.activeId);

/** True when the active preset is the Default preset, which refuses edits. */
export const isDefaultHelpPresetActive = (store: HelpPresetStore): boolean => customOf(store, store.activeId) === undefined;

/** The three texts the help session sends, chips in place. */
export const activeHelpPrompts = (store: HelpPresetStore): HelpPromptTexts => activeHelpPreset(store).prompts;

/** True when a prompt's text differs from the default text. */
export const isHelpPromptEdited = (prompts: HelpPromptTexts, key: HelpPromptKey): boolean => prompts[key] !== DEFAULT_HELP_PROMPTS[key];

/** Selects a preset. An id no preset holds selects the Default preset. */
export function selectHelpPreset(store: HelpPresetStore, id: string): HelpPresetStore {
  return { ...store, activeId: customOf(store, id)?.id ?? DEFAULT_HELP_PRESET_ID };
}

/** Adds a copy of the preset `sourceId` names under `id` and `name`, and selects it. */
export function duplicateHelpPreset(store: HelpPresetStore, sourceId: string, id: string, name: string): HelpPresetStore {
  const source = helpPresetOf(store, sourceId);
  return { activeId: id, presets: [...store.presets, { id, name, prompts: { ...source.prompts } }] };
}

/** The store with one custom preset changed. The Default preset refuses the change, so the store is returned as it is. */
function withCustom(store: HelpPresetStore, id: string, change: (preset: HelpPreset) => HelpPreset): HelpPresetStore {
  if (customOf(store, id) === undefined) return store;
  return { ...store, presets: store.presets.map((preset) => (preset.id === id ? change(preset) : preset)) };
}

/** Sets one prompt of a custom preset. */
export function editHelpPrompt(store: HelpPresetStore, id: string, key: HelpPromptKey, text: string): HelpPresetStore {
  return withCustom(store, id, (preset) => ({ ...preset, prompts: { ...preset.prompts, [key]: text } }));
}

/** Returns one prompt of a custom preset to the default text. */
export const resetHelpPrompt = (store: HelpPresetStore, id: string, key: HelpPromptKey): HelpPresetStore =>
  editHelpPrompt(store, id, key, DEFAULT_HELP_PROMPTS[key]);

/** Renames a custom preset. */
export function renameHelpPreset(store: HelpPresetStore, id: string, name: string): HelpPresetStore {
  return withCustom(store, id, (preset) => ({ ...preset, name }));
}

/** Removes a custom preset. When it was active, the Default preset becomes active. */
export function deleteHelpPreset(store: HelpPresetStore, id: string): HelpPresetStore {
  if (customOf(store, id) === undefined) return store;
  return { activeId: store.activeId === id ? DEFAULT_HELP_PRESET_ID : store.activeId, presets: store.presets.filter((preset) => preset.id !== id) };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';

/** A stored preset with its id, a name and three texts; anything else is dropped. */
function readPreset(value: unknown): HelpPreset | null {
  if (!isRecord(value) || !isText(value.id) || value.id === '' || !isText(value.name) || !isRecord(value.prompts)) return null;
  const { answer, pick, lookup } = value.prompts;
  if (!isText(answer) || !isText(pick) || !isText(lookup)) return null;
  return { id: value.id, name: value.name, prompts: { answer, pick, lookup } };
}

/**
 * The store as stored on the device. A value that is not a store reads as the empty store; a preset that is
 * not well formed is dropped; an active id no kept preset holds reads as the Default preset.
 */
export function parseHelpPresetStore(value: unknown): HelpPresetStore {
  if (!isRecord(value) || !Array.isArray(value.presets)) return EMPTY_HELP_PRESET_STORE;
  const seen = new Set<string>();
  const presets = value.presets.flatMap((entry) => {
    const preset = readPreset(entry);
    if (!preset || seen.has(preset.id)) return [];
    seen.add(preset.id);
    return [preset];
  });
  return selectHelpPreset({ activeId: DEFAULT_HELP_PRESET_ID, presets }, isText(value.activeId) ? value.activeId : DEFAULT_HELP_PRESET_ID);
}
