/**
 * The Formaquestion settings as one value. A help question carries them, so the help session reads no
 * setting from a constant. Nothing stores them yet: the window passes the defaults, and tests and probes
 * pass their own. No setting has an environment twin, and none is exported, synced or shared.
 */

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
  /** The most earlier exchanges one help request carries, newest kept. */
  readonly historyLength: number;
  /** The answer cap in tokens: room for a long list of steps. */
  readonly answerMaxTokens: number;
}

/** The settings of a player who has changed nothing. The help bar run measures these. */
export const DEFAULT_HELP_SETTINGS: HelpSettings = {
  sources: { keyword: true, aiPicks: true, semantic: false },
  lookup: false,
  historyLength: 4,
  answerMaxTokens: 800,
};

/** A change to the settings: any field, and inside `sources` only the switches it names. */
export type HelpSettingsChange = Partial<Omit<HelpSettings, 'sources'>> & { sources?: Partial<HelpSources> };

/** The defaults with a change applied. */
export function helpSettingsOf({ sources, ...change }: HelpSettingsChange = {}): HelpSettings {
  return { ...DEFAULT_HELP_SETTINGS, ...change, sources: { ...DEFAULT_HELP_SETTINGS.sources, ...sources } };
}
