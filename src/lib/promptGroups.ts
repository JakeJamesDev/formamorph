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

/** Which part of the selected prompt is on show. */
export type PromptSurface = 'system' | 'user' | 'messages' | 'options';

export const SURFACE_LABELS: Record<PromptSurface, string> = {
  system: 'System Prompt',
  user: 'User Message',
  messages: 'Messages',
  options: 'Options',
};

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
