/**
 * The Formaquestion settings as one value. A help question carries them, so the help session reads no
 * setting from a constant. The device stores them; tests and probes pass their own. No setting has an
 * environment twin, and none is exported, synced or shared.
 */
import {
  defaultPromptReasoningSetting, defaultReasoningBudgetPct, MAX_REASONING_BUDGET_PCT, MIN_REASONING_BUDGET_PCT, parsePromptReasoningSetting,
  type PromptReasoningSetting,
} from '@/lib/reasoningEffort';
import type { Codec } from '@/lib/usePersistentState';
import { EMPTY_HELP_PRESET_STORE, parseHelpPresetStore, type HelpPresetStore } from './helpPresets';
import { DEFAULT_HELP_REVEAL, parseHelpReveal, type HelpReveal } from './helpReveal';

/** The search sources of a help question. The rankings of the ones that are on merge into one. */
export interface HelpSources {
  /** The Docs Index search, with the docs' keyword lines. */
  readonly keyword: boolean;
  /** One request before the answer, in which the model picks sections from the guide's headings. */
  readonly aiPicks: boolean;
  /** Sections ranked by meaning. It runs only when the embedding model is on the device. */
  readonly semantic: boolean;
}

/** The Pick Endpoint choice that sends picks where answers go. */
export const SAME_AS_ANSWER = 'same-as-answer';

/** Every setting a help question carries. */
export interface HelpSettings {
  /** The sources whose rankings the search of a question merges. */
  readonly sources: HelpSources;
  /** The text-endpoint preset answers go to, or null to follow the active endpoint. */
  readonly answerEndpoint: string | null;
  /** The preset picks go to, `SAME_AS_ANSWER`, or null to follow the active endpoint. */
  readonly pickEndpoint: string | null;
  /** Lookup mode: the model reads more sections through the guide lookup, where the endpoint takes function calls (ADR-0009). */
  readonly lookup: boolean;
  /** The open screen's section leads the docs, and the request names the screen. */
  readonly openScreen: boolean;
  /** The most earlier exchanges one help request carries, newest kept. */
  readonly historyLength: number;
  /** The answer request's reasoning switch and strength. The pick request never reasons. */
  readonly reasoning: PromptReasoningSetting;
  /** The answer request's reasoning budget, in percent of the endpoint's Max Output. */
  readonly reasoningBudget: number;
  /** The state a Sources list takes when its answer's sources arrive. A click on a list sets it. */
  readonly sourcesOpen: boolean;
  /** The state a Thinking block takes when its answer's first reasoning text arrives. A click on a block sets it. */
  readonly thinkingOpen: boolean;
  /** How an answer reveals as it streams: the Answer Reveal dialog's values. */
  readonly reveal: HelpReveal;
  /** The help prompt presets and the active one. The session sends the active preset's three texts. */
  readonly presets: HelpPresetStore;
}

/** The settings of a player who has changed nothing. The help bar run measures these. */
export const DEFAULT_HELP_SETTINGS: HelpSettings = {
  sources: { keyword: true, aiPicks: true, semantic: false },
  answerEndpoint: null,
  pickEndpoint: SAME_AS_ANSWER,
  lookup: false,
  openScreen: true,
  historyLength: 4,
  reasoning: defaultPromptReasoningSetting('help'),
  reasoningBudget: defaultReasoningBudgetPct('help'),
  sourcesOpen: true,
  thinkingOpen: false,
  reveal: DEFAULT_HELP_REVEAL,
  presets: EMPTY_HELP_PRESET_STORE,
};

/** A change to the settings: any field, and inside `sources` and `reveal` only the values it names. */
export type HelpSettingsChange = Partial<Omit<HelpSettings, 'sources' | 'reveal'>> & { sources?: Partial<HelpSources>; reveal?: Partial<HelpReveal> };

/** The settings, the defaults when none are given, with a change applied. */
export function helpSettingsOf({ sources, reveal, ...change }: HelpSettingsChange = {}, base: HelpSettings = DEFAULT_HELP_SETTINGS): HelpSettings {
  return { ...base, ...change, sources: { ...base.sources, ...sources }, reveal: { ...base.reveal, ...reveal } };
}

/** The most earlier exchanges the History Length field takes. */
export const HELP_HISTORY_MAX = 20;

type Check = (value: unknown) => boolean;
const isBool: Check = (value) => typeof value === 'boolean';
const isBetween = (min: number, max: number): Check => (value) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const isCount = (max: number): Check => isBetween(0, max);

/** A preset id, or null for Follow Active. */
const isPresetId: Check = (value) => value === null || (typeof value === 'string' && value !== '' && value !== SAME_AS_ANSWER);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The stored field when it passes its check, else the default. */
function pick<T>(stored: Record<string, unknown>, fallback: T, checks: { [K in keyof T]: Check }): T {
  const entries = Object.entries(checks).map(([key, check]) => [key, (check as Check)(stored[key]) ? stored[key] : fallback[key as keyof T]]);
  return Object.fromEntries(entries) as T;
}

/** The settings on the device as JSON. A bad field takes its default; text that is not an object is refused. */
export const helpSettingsCodec: Codec<HelpSettings> = {
  parse: (raw) => {
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) throw new Error('not a help settings object');
    const { sources, reveal, presets, ...rest } = pick<HelpSettings>(stored, DEFAULT_HELP_SETTINGS, {
      sources: isRecord,
      answerEndpoint: isPresetId,
      pickEndpoint: (value) => value === SAME_AS_ANSWER || isPresetId(value),
      lookup: isBool,
      openScreen: isBool,
      historyLength: isCount(HELP_HISTORY_MAX),
      reasoning: (value) => isRecord(value) && parsePromptReasoningSetting(value) !== null,
      reasoningBudget: isBetween(MIN_REASONING_BUDGET_PCT, MAX_REASONING_BUDGET_PCT),
      sourcesOpen: isBool,
      thinkingOpen: isBool,
      reveal: isRecord,
      presets: isRecord,
    });
    const storedSources = isRecord(sources) ? sources : {};
    return { ...rest, reveal: parseHelpReveal(reveal), presets: parseHelpPresetStore(presets), sources: pick(storedSources, DEFAULT_HELP_SETTINGS.sources, { keyword: isBool, aiPicks: isBool, semantic: isBool }) };
  },
  serialize: (value) => JSON.stringify(value),
};
