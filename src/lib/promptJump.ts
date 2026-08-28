import type { AIRequestType } from '@/types';
import type { AnatomySource, ContextLabel } from './requestAnatomy';
import type { PromptSurface } from './promptGroups';

/**
 * Where a highlighted run in a Request Anatomy goes when it is clicked: the prompt it belongs to, the
 * editor that owns its text, and — for the narration's stacked message fields — which of them.
 *
 * Pure and shared, so the Settings hub and the in-game AI-context viewer resolve a click the same way. A
 * run names its *editor* (System Prompt, User Message, …), which every pass has one of; which prompt that
 * editor belongs to comes from the request's own type.
 */

/** Which prompt in the Settings rail owns each kind of request. A request with no editor surface at all —
 *  the discovery pass, the milestone selector — is absent, so a run on one has nowhere to go. */
export const PROMPT_TAB_FOR_REQUEST: Partial<Record<AIRequestType, string>> = {
  narration: 'narration',
  thinking: 'thinking',
  director: 'director',
  character: 'character',
  storyboard: 'storyboard',
  choices: 'choices',
  statUpdates: 'statupdates',
  locationChange: 'location',
  summary: 'summary',
  diary: 'diary',
  timePassed: 'timepassed',
  openingTime: 'timeopening',
  sceneTags: 'scenetags',
};

/** The conditional narration lines the Messages view stacks, each its own field there. */
export type MessageField = 'recap' | 'now' | 'recall' | 'direction';

const MESSAGE_FIELDS: readonly AnatomySource[] = ['recap', 'now', 'recall', 'direction'];

/**
 * Where a click lands: which prompt, which editor, which stacked field to scroll to and focus, and which
 * chip to reveal once there. No `surface` means the prompt's Anatomy hub — the state with no editor open.
 */
export interface PromptJumpTarget {
  tab: string;
  surface?: PromptSurface;
  field?: MessageField;
  /** The affix-free token of the chip to scroll to and ring on arrival. */
  chip?: string;
}

/**
 * Resolve one authored run to the editor that owns its text, or null when nothing owns it. Assembled runs
 * are never passed here — see {@link resolveContextJump} for the few whose content another prompt wrote.
 */
export function resolvePromptJump(source: AnatomySource, type: AIRequestType): PromptJumpTarget | null {
  // These four ride the narration exchange and are edited on the Narration prompt, whatever pass a
  // capture carrying them belongs to.
  if (MESSAGE_FIELDS.includes(source)) {
    return { tab: 'narration', surface: 'messages', field: source as MessageField };
  }
  const tab = PROMPT_TAB_FOR_REQUEST[type];
  if (!tab) return null;
  return { tab, surface: source === 'user-template' ? 'user' : 'system' };
}

/** The same jump, plus the chip to reveal — where the run is one chip's value rather than the prose
 *  around it. Null wherever the template's own editor has nowhere to open. */
export function resolveChipJump(
  source: AnatomySource,
  type: AIRequestType,
  chip: string,
): PromptJumpTarget | null {
  const target = resolvePromptJump(source, type);
  return target ? { ...target, chip } : null;
}

/**
 * Which prompt wrote the content behind each assembled run. Following one goes to that prompt's Anatomy
 * hub, so the hub reads as a map of the turn: a block here, the request that produced it one click away.
 *
 * Absent labels are the ones nobody authored — the player's own action, the turns already played, their
 * notes, the directive a Thinking mode adds — so a chip for one of those stays inert.
 */
export const CONTEXT_OWNER: Partial<Record<ContextLabel, string>> = {
  'turn-plan': 'thinking',
  narration: 'narration',
  'character-brief': 'character',
  intents: 'character',
  'diary-brief': 'diary',
  condensed: 'summary',
  'scene-cast': 'scenetags',
};

/** The prompt whose anatomy an assembled run leads to, or null where nothing wrote it. */
export function resolveContextJump(label: ContextLabel): PromptJumpTarget | null {
  const tab = CONTEXT_OWNER[label];
  return tab ? { tab } : null;
}
