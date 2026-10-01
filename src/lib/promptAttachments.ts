import type { AIRequestType } from '@/types';

/** Per-request Include Attachments flags carried on a preset; an absent kind takes its default. */
export type PromptAttachmentsMap = Partial<Record<AIRequestType, boolean>>;

/** The prompts whose turn pass sends the player action, so the only ones that can carry its images. */
export const ATTACHMENT_PROMPTS: ReadonlySet<AIRequestType> = new Set<AIRequestType>([
  'narration', 'thinking', 'director', 'character', 'storyboard',
  'choices', 'statUpdates', 'locationChange', 'timePassed', 'summary',
]);

/** Whether a prompt's pass receives the action's images: its stored flag, else on for Narration only. */
export function includesAttachments(map: PromptAttachmentsMap, kind: AIRequestType): boolean {
  if (!ATTACHMENT_PROMPTS.has(kind)) return false;
  return map[kind] ?? kind === 'narration';
}

/** Keeps only boolean flags for prompts that can carry images. */
export function sanitizePromptAttachments(raw: unknown): PromptAttachmentsMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: PromptAttachmentsMap = {};
  for (const [kind, flag] of Object.entries(raw as Record<string, unknown>)) {
    if (ATTACHMENT_PROMPTS.has(kind as AIRequestType) && typeof flag === 'boolean') out[kind as AIRequestType] = flag;
  }
  return Object.keys(out).length ? out : undefined;
}
