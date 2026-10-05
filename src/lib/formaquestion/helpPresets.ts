/**
 * The help preset store: the help prompts and the Code rider as one named set. The Default preset is read-only
 * and reads its texts and options from the code, so each release updates it for every player who has no custom
 * preset. A custom preset stores its own four texts and three option blocks. The store is a device
 * setting, apart from the gameplay prompt presets.
 */
import { HELP_PICK_MAX_TOKENS } from './helpPicks';
import { DEFAULT_HELP_PROMPTS, type HelpPromptKey, type HelpPromptTexts, type HelpRequestKey } from './helpPrompt';

/** One request's sampler values and cap. A preset holds them, so the Default preset's follow the code. */
export interface HelpRequestOptions {
  readonly temperature: number;
  readonly repetitionPenalty: number;
  readonly maxTokens: number;
}

/** One option block per request prompt: each prompt's request sends its own. The rider rides the answer's. */
export type HelpPresetOptions = { readonly [K in HelpRequestKey]: HelpRequestOptions };

/** The answer caps leave room for a long list of steps; the pick cap, for the copied lines. */
export const DEFAULT_HELP_OPTIONS: HelpPresetOptions = {
  answer: { temperature: 0.2, repetitionPenalty: 1, maxTokens: 800 },
  pick: { temperature: 0.2, repetitionPenalty: 1, maxTokens: HELP_PICK_MAX_TOKENS },
  lookup: { temperature: 0.2, repetitionPenalty: 1, maxTokens: 800 },
};

/** The ranges the option fields take. */
export const HELP_TEMPERATURE_RANGE = { min: 0, max: 2, step: 0.05 } as const;
export const HELP_REPETITION_PENALTY_RANGE = { min: 1, max: 1.5, step: 0.02 } as const;

export interface HelpPreset {
  readonly id: string;
  readonly name: string;
  readonly prompts: HelpPromptTexts;
  readonly options: HelpPresetOptions;
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
export const defaultHelpPreset = (): HelpPreset => ({ id: DEFAULT_HELP_PRESET_ID, name: DEFAULT_HELP_PRESET_NAME, prompts: DEFAULT_HELP_PROMPTS, options: DEFAULT_HELP_OPTIONS });

/** One block per prompt, each made by `block`. */
export const mapHelpOptions = (block: (key: HelpRequestKey) => HelpRequestOptions): HelpPresetOptions => ({ answer: block('answer'), pick: block('pick'), lookup: block('lookup') });

const copyOptions = (options: HelpPresetOptions): HelpPresetOptions => mapHelpOptions((key) => ({ ...options[key] }));

const customOf = (store: HelpPresetStore, id: string): HelpPreset | undefined => store.presets.find((preset) => preset.id === id);

/** The preset `id` names: a custom preset, else the Default preset, for the Default id or an id no preset holds. */
export function helpPresetOf(store: HelpPresetStore, id: string): HelpPreset {
  return customOf(store, id) ?? defaultHelpPreset();
}

/** The active preset. An active id no preset holds reads as the Default preset. */
export const activeHelpPreset = (store: HelpPresetStore): HelpPreset => helpPresetOf(store, store.activeId);

/** True when the active preset is the Default preset, which refuses edits. */
export const isDefaultHelpPresetActive = (store: HelpPresetStore): boolean => customOf(store, store.activeId) === undefined;

/** The texts the help session sends, chips in place. */
export const activeHelpPrompts = (store: HelpPresetStore): HelpPromptTexts => activeHelpPreset(store).prompts;

/** The option blocks the help session sends. */
export const activeHelpOptions = (store: HelpPresetStore): HelpPresetOptions => activeHelpPreset(store).options;

/** True when a prompt's text differs from the default text. */
export const isHelpPromptEdited = (prompts: HelpPromptTexts, key: HelpPromptKey): boolean => prompts[key] !== DEFAULT_HELP_PROMPTS[key];

/** Selects a preset. An id no preset holds selects the Default preset. */
export function selectHelpPreset(store: HelpPresetStore, id: string): HelpPresetStore {
  return { ...store, activeId: customOf(store, id)?.id ?? DEFAULT_HELP_PRESET_ID };
}

/** Adds a copy of the preset `sourceId` names under `id` and `name`, and selects it. */
export function duplicateHelpPreset(store: HelpPresetStore, sourceId: string, id: string, name: string): HelpPresetStore {
  const source = helpPresetOf(store, sourceId);
  return { activeId: id, presets: [...store.presets, { id, name, prompts: { ...source.prompts }, options: copyOptions(source.options) }] };
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

/** Sets options of one prompt's block in a custom preset. */
export const editHelpOptions = (store: HelpPresetStore, id: string, key: HelpRequestKey, change: Partial<HelpRequestOptions>): HelpPresetStore =>
  withCustom(store, id, (preset) => ({ ...preset, options: { ...preset.options, [key]: { ...preset.options[key], ...change } } }));

/** Returns one prompt of a custom preset to the default text. */
export const resetHelpPrompt = (store: HelpPresetStore, id: string, key: HelpPromptKey): HelpPresetStore =>
  editHelpPrompt(store, id, key, DEFAULT_HELP_PROMPTS[key]);

/** Returns every text of a custom preset, and its options, to the defaults. */
export const resetHelpPreset = (store: HelpPresetStore, id: string): HelpPresetStore =>
  withCustom(store, id, (preset) => ({ ...preset, prompts: { ...DEFAULT_HELP_PROMPTS }, options: copyOptions(DEFAULT_HELP_OPTIONS) }));

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

const isNumberIn = ({ min, max }: { min: number; max: number }) => (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isTemperature = isNumberIn(HELP_TEMPERATURE_RANGE);
const isPenalty = isNumberIn(HELP_REPETITION_PENALTY_RANGE);

/** A stored option block, each bad or missing field read as the Default's. */
function readStoredBlock(value: unknown, { temperature, repetitionPenalty, maxTokens }: HelpRequestOptions): HelpRequestOptions {
  const stored = isRecord(value) ? value : {};
  return {
    temperature: isTemperature(stored.temperature) ? stored.temperature : temperature,
    repetitionPenalty: isPenalty(stored.repetitionPenalty) ? stored.repetitionPenalty : repetitionPenalty,
    maxTokens: Number.isInteger(stored.maxTokens) && (stored.maxTokens as number) > 0 ? (stored.maxTokens as number) : maxTokens,
  };
}

/** Stored option blocks, each read on its own. */
function readOptions(value: unknown): HelpPresetOptions {
  const stored = isRecord(value) ? value : {};
  return mapHelpOptions((key) => readStoredBlock(stored[key], DEFAULT_HELP_OPTIONS[key]));
}

/** A stored preset with its id, a name and four texts; anything else is dropped. */
function readPreset(value: unknown): HelpPreset | null {
  if (!isRecord(value) || !isText(value.id) || value.id === '' || !isText(value.name) || !isRecord(value.prompts)) return null;
  const { answer, pick, lookup, code } = value.prompts;
  if (!isText(answer) || !isText(pick) || !isText(lookup) || !isText(code)) return null;
  return { id: value.id, name: value.name, prompts: { answer, pick, lookup, code }, options: readOptions(value.options) };
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
