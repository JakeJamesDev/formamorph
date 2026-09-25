import type { AIRequestType } from '@/types';

/**
 * How the prompt list is grouped in Settings → Prompts' rail. Thirteen flat tabs wrapped into three rows
 * and told the reader nothing about what each prompt is for; grouped by the job they do, the list reads as
 * a map of the pipeline. Order within a group is the order the pipeline runs them.
 *
 * The ids are the same `promptTab` keys the panel already switches on, so grouping is presentation only —
 * `promptTabAvailability` still decides which exist, and a prompt whose feature is off never appears.
 */
export interface PromptGroup {
  label: string;
  /** `promptTab` ids, in pipeline order. */
  tabs: string[];
}

export const PROMPT_GROUPS: PromptGroup[] = [
  { label: 'Story', tabs: ['narration', 'thinking', 'director', 'character', 'discover', 'storyboard', 'choices'] },
  { label: 'Trackers', tabs: ['statupdates', 'location', 'timepassed', 'timeopening'] },
  { label: 'Memory', tabs: ['summary', 'milestone', 'diary'] },
  { label: 'Images', tabs: ['scenetags'] },
];

/** Every prompt the Settings rail can select — the `promptTab` ids. A jump target names one of these, so
 *  a map keyed by it is total and a lookup needs no fallback. */
export type PromptTab =
  | 'narration' | 'thinking' | 'director' | 'character' | 'discover' | 'storyboard' | 'choices'
  | 'statupdates' | 'location' | 'timepassed' | 'timeopening'
  | 'summary' | 'milestone' | 'diary'
  | 'scenetags';

/** Which request each tab tunes: its samplers, endpoint pin and reasoning rows read and write this type. */
export const PROMPT_TAB_REQUESTS: Record<PromptTab, AIRequestType> = {
  narration: 'narration',
  thinking: 'thinking',
  director: 'director',
  character: 'character',
  discover: 'discoverEntity',
  storyboard: 'storyboard',
  choices: 'choices',
  statupdates: 'statUpdates',
  location: 'locationChange',
  timepassed: 'timePassed',
  timeopening: 'openingTime',
  summary: 'summary',
  milestone: 'milestoneSelect',
  diary: 'diary',
  scenetags: 'sceneTags',
};

export function isPromptTab(tab: string): tab is PromptTab {
  return Object.hasOwn(PROMPT_TAB_REQUESTS, tab);
}

/** What each prompt is called wherever it is named: the rail's own row, and a jump that says where it
 *  goes. */
export const PROMPT_LABELS: Record<PromptTab, string> = {
  narration: 'Narration',
  thinking: 'Planning',
  choices: 'Choices',
  statupdates: 'Stat Updates',
  location: 'Location Change',
  summary: 'Summaries',
  milestone: 'Milestone Select',
  timepassed: 'Clock',
  timeopening: 'Opening',
  scenetags: 'Scene Tags',
  diary: 'Diary',
  director: 'Director',
  character: 'Character',
  discover: 'Discover Entity',
  storyboard: 'Storyboard',
};

/** Each request under the name of the prompt that sends it. */
export const REQUEST_LABELS = Object.fromEntries(
  (Object.entries(PROMPT_TAB_REQUESTS) as [PromptTab, AIRequestType][]).map(([tab, kind]) => [kind, PROMPT_LABELS[tab]]),
) as Record<AIRequestType, string>;

/**
 * One line per prompt, saying what job it does in the turn — shown above the editor, where it is read
 * before the prompt rather than after it. Written to the Writing Guide's help-line test: verb-first,
 * "you" for the player, no period on one sentence.
 *
 * Deliberately no "only used when X is on" clauses: a prompt whose feature is off never reaches the list
 * (see `visibleGroups`), so the caveat only ever appeared on prompts it wasn't true of.
 */
export const PROMPT_DESCRIPTIONS: Record<string, string> = {
  narration: 'Writes the story itself, the prose you read each turn',
  thinking: "Plans the turn before it's written: who's present, and what happens next",
  choices: 'Offers your options for the turn, written in your own voice',
  statupdates: 'Reads what happened and records which stats it moved',
  location: 'Decides whether your action takes you somewhere new',
  summary: 'Condenses an older turn into one line the storyteller can still read later',
  milestone: 'Decides, between turns, which condensed turns stay in long-term memory',
  diary: "Records each present character's private, first-person note on the turn",
  timepassed: 'Measures how much in-world time a turn took',
  timeopening: 'Reads the opening scene once to decide what time of day the story starts',
  scenetags: "Tags only the action in a scene image. The characters' looks and the setting come from their own tags.",
  director: "Describes the scene for the turn: who's here, and what each of them is doing",
  character: 'States what one character wants this turn, in the first person',
  discover: 'Writes a lasting note for each new character the story names, and rewrites it on request',
  storyboard: "Reconciles every character's intentions into a single plan for the turn",
};

/** Which editor of the selected prompt is on show. Null is the Anatomy hub: the prompt selected with no
 *  editor open, which is where selecting a prompt lands. */
export type PromptSurface = 'system' | 'user' | 'messages' | 'options';

export const SURFACE_LABELS: Record<PromptSurface, string> = {
  system: 'System Prompt',
  user: 'User Message',
  messages: 'Messages',
  options: 'Options',
};

/** What the hub is called wherever it needs a name of its own — the rail's own row for it, and the
 *  dev-router's `surface=…` value. */
export const HUB_LABEL = 'Anatomy';
export const HUB_ROUTE = 'anatomy';

/** Every `surface=…` value the dev-router accepts: the editors, plus the hub. */
export const PROMPT_SURFACE_ROUTES: string[] = [...Object.keys(SURFACE_LABELS), HUB_ROUTE];

/** The preset-level rail entry above the prompt groups, shown for user presets only. Its route is a
 *  `subtab=…` value, since it stands in place of a prompt. */
export const OVERVIEW_LABEL = 'Overview';
export const OVERVIEW_ROUTE = 'overview';

/** Every preset-level `subtab=…` value the dev-router accepts. */
export const PRESET_ROUTES: string[] = [OVERVIEW_ROUTE];

/**
 * The groups with their unavailable prompts removed, and empty groups dropped — so a player with images
 * off doesn't see an "Images" heading over nothing.
 */
export function visibleGroups(available: Record<string, boolean>): PromptGroup[] {
  return PROMPT_GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => available[t]) }))
    .filter((g) => g.tabs.length > 0);
}

/** Every grouped id, for the guard that keeps this list in step with the panel's own tabs. */
export function allGroupedTabs(): string[] {
  return PROMPT_GROUPS.flatMap((g) => g.tabs);
}
