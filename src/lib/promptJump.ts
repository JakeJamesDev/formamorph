import type { AIRequestType } from '@/types';
import type { AnatomySource } from './requestAnatomy';
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

/** Where a click lands: which prompt, which editor, and which stacked field to scroll to and focus. */
export interface PromptJumpTarget {
  tab: string;
  surface: PromptSurface;
  field?: MessageField;
}

/**
 * Resolve one authored run to the editor that owns its text, or null when nothing owns it. Context runs
 * are never passed here — the app assembled them, so there is nothing to open.
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
