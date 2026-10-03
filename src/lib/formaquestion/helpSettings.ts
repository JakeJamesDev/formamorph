/**
 * The Formaquestion settings as one value. A help question carries them, so the help session reads no
 * setting from a constant. The device stores them; tests and probes pass their own. No setting has an
 * environment twin, and none is exported, synced or shared.
 */
import type { Codec } from '@/lib/usePersistentState';

/** The search sources of a help question. The rankings of the ones that are on merge into one. */
export interface HelpSources {
  /** The Docs Index search, with the docs' keyword lines. */
  readonly keyword: boolean;
  /** One request before the answer, in which the model picks sections from the guide's headings. */
  readonly aiPicks: boolean;
  /** Sections ranked by meaning. It runs only when the embedding model is on the device. */
  readonly semantic: boolean;
}

/** Every setting a help question carries. */
export interface HelpSettings {
  /** The sources whose rankings the search of a question merges. */
  readonly sources: HelpSources;
  /** Lookup mode: the model reads more sections through the guide lookup, where the endpoint takes function calls (ADR-0009). */
  readonly lookup: boolean;
  /** The open screen's section leads the docs, and the request names the screen. */
  readonly openScreen: boolean;
  /** The most earlier exchanges one help request carries, newest kept. */
  readonly historyLength: number;
  /** The answer cap in tokens: room for a long list of steps. */
  readonly answerMaxTokens: number;
  /** The state a Sources list takes when its answer's sources arrive. A click on a list sets it. */
  readonly sourcesOpen: boolean;
}

/** The settings of a player who has changed nothing. The help bar run measures these. */
export const DEFAULT_HELP_SETTINGS: HelpSettings = {
  sources: { keyword: true, aiPicks: true, semantic: false },
  lookup: false,
  openScreen: true,
  historyLength: 4,
  answerMaxTokens: 800,
  sourcesOpen: true,
};

/** A change to the settings: any field, and inside `sources` only the switches it names. */
export type HelpSettingsChange = Partial<Omit<HelpSettings, 'sources'>> & { sources?: Partial<HelpSources> };

/** The settings, the defaults when none are given, with a change applied. */
export function helpSettingsOf({ sources, ...change }: HelpSettingsChange = {}, base: HelpSettings = DEFAULT_HELP_SETTINGS): HelpSettings {
  return { ...base, ...change, sources: { ...base.sources, ...sources } };
}

/** The most earlier exchanges the History Length field takes. */
export const HELP_HISTORY_MAX = 20;

type Check = (value: unknown) => boolean;
const isBool: Check = (value) => typeof value === 'boolean';
const isCount = (max: number): Check => (value) => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

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
    const { sources, ...rest } = pick<HelpSettings>(stored, DEFAULT_HELP_SETTINGS, {
      sources: isRecord,
      lookup: isBool,
      openScreen: isBool,
      historyLength: isCount(HELP_HISTORY_MAX),
      answerMaxTokens: (value) => Number.isInteger(value) && (value as number) > 0,
      sourcesOpen: isBool,
    });
    const storedSources = isRecord(sources) ? sources : {};
    return { ...rest, sources: pick(storedSources, DEFAULT_HELP_SETTINGS.sources, { keyword: isBool, aiPicks: isBool, semantic: isBool }) };
  },
  serialize: (value) => JSON.stringify(value),
};
