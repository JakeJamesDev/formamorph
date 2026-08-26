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
  { label: 'Story', tabs: ['narration', 'thinking', 'director', 'character', 'storyboard', 'choices'] },
  { label: 'Trackers', tabs: ['statupdates', 'location', 'timepassed', 'timeopening'] },
  { label: 'Memory', tabs: ['summary', 'diary'] },
  { label: 'Images', tabs: ['scenetags'] },
];

/**
 * One line per prompt, saying what job it does in the turn — shown above the editor, where it is read
 * before the prompt rather than after it.
 *
 * Deliberately no "only used when X is on" clauses: a prompt whose feature is off never reaches the list
 * (see `visibleGroups`), so the caveat only ever appeared on prompts it wasn't true of.
 */
export const PROMPT_DESCRIPTIONS: Record<string, string> = {
  narration: 'Writes the story itself — the prose the player reads each turn.',
  thinking: 'Plans the turn before it is written: who is present, and what happens next.',
  choices: "Offers the player their options, written in the player's own voice.",
  statupdates: 'Reads what happened and records which stats it moved.',
  location: "Decides whether the player's action takes them somewhere new.",
  summary: 'Condenses an older turn into one line the storyteller can still read later.',
  diary: 'Each character present records a private, first-person note on the turn.',
  timepassed: 'Measures how much in-world time a turn took.',
  timeopening: 'Reads the opening scene once, to settle what time of day the story starts.',
  scenetags: "Tags what is happening in a scene image — the action only, since the characters' looks and the setting come from their own tags.",
  director: 'Sets the stage for the turn: who is here, and what each of them is doing.',
  character: 'One character states, in the first person, what they want this turn.',
  storyboard: "Reconciles every character's intentions into a single plan for the turn.",
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
