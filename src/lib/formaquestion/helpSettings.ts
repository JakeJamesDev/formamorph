/**
 * The Formaquestion settings as one value. A help question carries them, so the help session reads no
 * setting from a constant. The device stores them; tests and probes pass their own. No setting has an
 * environment twin, and none is exported, synced or shared.
 */
import { DEFAULT_TOOL_CALL_LIMIT } from '@/contexts/settingsDefaults';
import {
  defaultPromptReasoningSetting, defaultReasoningBudgetPct, MAX_REASONING_BUDGET_PCT, MIN_REASONING_BUDGET_PCT, parsePromptReasoningSetting,
  type PromptReasoningSetting,
} from '@/lib/reasoningEffort';
import type { Codec } from '@/lib/usePersistentState';
import type { Tool, ToolEnabledMap } from '@/types';
import { DOCS_LOOKUP_CALL_LIMIT } from './docsLookup';
import { EMPTY_HELP_PRESET_STORE, parseHelpPresetStore, type HelpPresetStore } from './helpPresets';
import { DEFAULT_HELP_REVEAL, parseHelpReveal, type HelpReveal } from './helpReveal';
import { parseHelpTools, parseHelpToolSwitches } from './helpTools';
import { EMPTY_MASCOT_PRESET_STORE, parseMascotPresetStore, type MascotPresetStore } from './mascotPresets';
import type { WindowChrome } from './windowBox';

/** The search sources of a help question. The rankings of the ones that are on merge into one. */
export interface HelpSources {
  /** The Docs Index search, with the docs' keyword lines. */
  readonly keyword: boolean;
  /** One request before the answer, in which the model picks sections from the guide's headings. */
  readonly aiPicks: boolean;
  /** Sections ranked by meaning. It runs only when the embedding model is on the device. */
  readonly semantic: boolean;
}

/** The Search Endpoint choice that sends the search request where answers go. */
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
  /** The most guide lookup calls one help question runs. */
  readonly lookupCallLimit: number;
  /** The help dice roll is offered, where the endpoint takes function calls. */
  readonly roll: boolean;
  /** The most help dice roll calls one help question runs. */
  readonly rollCallLimit: number;
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
  /** The player's Formaquestion Tools: a list of their own, apart from the gameplay Tools (ADR-0010). */
  readonly tools: readonly Tool[];
  /** The switch of each Formaquestion Tool, by id. Absent is off. */
  readonly toolSwitches: ToolEnabledMap;
  /** The Mascot stands beside the chat. Under the Auto chat style the window then takes the bubble chrome. */
  readonly mascot: boolean;
  /** The mascot presets and the active one. The window, the face call and AI Context draw the active mascot's rig. */
  readonly mascotPresets: MascotPresetStore;
  /** The window's chrome: Auto follows the Mascot switch; Bubble, Minimal and Full pin it. */
  readonly chatStyle: ChatStyle;
  /** The Scrim's opacity in percent: the panel of the app background behind the minimal column. 0 draws nothing. */
  readonly scrimOpacity: number;
}

/** The Scrim opacity's range and step, in percent. */
export const SCRIM_OPACITY_MIN = 0;
export const SCRIM_OPACITY_MAX = 100;
export const SCRIM_OPACITY_STEP = 5;

export const CHAT_STYLES = ['auto', 'bubble', 'minimal', 'full'] as const;
export type ChatStyle = (typeof CHAT_STYLES)[number];
export const isChatStyle = (value: unknown): value is ChatStyle => CHAT_STYLES.some((style) => style === value);

/** The chrome the window draws: Auto is Bubble while the Mascot is on, and Bubble without her has no speaker, so it draws Minimal. */
export function chatChrome({ chatStyle, mascot }: Pick<HelpSettings, 'chatStyle' | 'mascot'>): WindowChrome {
  if (chatStyle === 'auto') return mascot ? 'bubble' : 'full';
  if (chatStyle === 'bubble' && !mascot) return 'minimal';
  return chatStyle;
}

/** The settings of a player who has changed nothing. The help bar run measures these. */
export const DEFAULT_HELP_SETTINGS: HelpSettings = {
  sources: { keyword: true, aiPicks: true, semantic: false },
  answerEndpoint: null,
  pickEndpoint: SAME_AS_ANSWER,
  lookup: false,
  lookupCallLimit: DOCS_LOOKUP_CALL_LIMIT,
  roll: false,
  // The catalog roll's limit, so a roll behaves the same in help and in play (Q61).
  rollCallLimit: DEFAULT_TOOL_CALL_LIMIT,
  openScreen: true,
  historyLength: 4,
  reasoning: defaultPromptReasoningSetting('help'),
  reasoningBudget: defaultReasoningBudgetPct('help'),
  sourcesOpen: true,
  thinkingOpen: false,
  reveal: DEFAULT_HELP_REVEAL,
  presets: EMPTY_HELP_PRESET_STORE,
  tools: [],
  toolSwitches: {},
  mascot: true,
  mascotPresets: EMPTY_MASCOT_PRESET_STORE,
  chatStyle: 'auto',
  scrimOpacity: 60,
};

/** A change to the settings: any field, and inside `sources` and `reveal` only the values it names. */
export type HelpSettingsChange = Partial<Omit<HelpSettings, 'sources' | 'reveal'>> & { sources?: Partial<HelpSources>; reveal?: Partial<HelpReveal> };

/** The settings, the defaults when none are given, with a change applied. */
export function helpSettingsOf({ sources, reveal, ...change }: HelpSettingsChange = {}, base: HelpSettings = DEFAULT_HELP_SETTINGS): HelpSettings {
  return { ...base, ...change, sources: { ...base.sources, ...sources }, reveal: { ...base.reveal, ...reveal } };
}

/** The most earlier exchanges the History Length field takes. */
export const HELP_HISTORY_MAX = 20;

/** The most calls of one fixed function the Max Calls per Request field takes. */
export const HELP_CALL_LIMIT_MAX = 20;

/** A Max Calls per Request entry as the setting holds it: none is the function's default, more than the most is the most. */
export const callLimitOf = (limit: number | undefined, fallback: number): number => Math.min(limit ?? fallback, HELP_CALL_LIMIT_MAX);

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
    const { sources, reveal, presets, tools, toolSwitches, mascotPresets, ...rest } = pick<HelpSettings>(stored, DEFAULT_HELP_SETTINGS, {
      sources: isRecord,
      answerEndpoint: isPresetId,
      pickEndpoint: (value) => value === SAME_AS_ANSWER || isPresetId(value),
      lookup: isBool,
      lookupCallLimit: isBetween(1, HELP_CALL_LIMIT_MAX),
      roll: isBool,
      rollCallLimit: isBetween(1, HELP_CALL_LIMIT_MAX),
      openScreen: isBool,
      historyLength: isCount(HELP_HISTORY_MAX),
      reasoning: (value) => isRecord(value) && parsePromptReasoningSetting(value) !== null,
      reasoningBudget: isBetween(MIN_REASONING_BUDGET_PCT, MAX_REASONING_BUDGET_PCT),
      sourcesOpen: isBool,
      thinkingOpen: isBool,
      reveal: isRecord,
      presets: isRecord,
      tools: Array.isArray,
      toolSwitches: isRecord,
      mascot: isBool,
      mascotPresets: isRecord,
      chatStyle: isChatStyle,
      scrimOpacity: (value) => isBetween(SCRIM_OPACITY_MIN, SCRIM_OPACITY_MAX)(value) && (value as number) % SCRIM_OPACITY_STEP === 0,
    });
    const storedSources = isRecord(sources) ? sources : {};
    const storedTools = parseHelpTools(tools);
    return {
      ...rest,
      reveal: parseHelpReveal(reveal),
      presets: parseHelpPresetStore(presets),
      sources: pick(storedSources, DEFAULT_HELP_SETTINGS.sources, { keyword: isBool, aiPicks: isBool, semantic: isBool }),
      tools: storedTools,
      toolSwitches: parseHelpToolSwitches(toolSwitches, storedTools),
      mascotPresets: parseMascotPresetStore(mascotPresets),
    };
  },
  serialize: (value) => JSON.stringify(value),
};
