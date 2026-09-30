import type { AIRequestType } from '@/types';
import { PROMPT_TAB_REQUESTS } from '@/lib/promptGroups';

/** Per-request Include Attachments flags carried on a preset; an absent kind takes its default. */
export type PromptAttachmentsMap = Partial<Record<AIRequestType, boolean>>;

const KINDS: readonly string[] = Object.values(PROMPT_TAB_REQUESTS);

/** Whether a prompt's pass receives the action's images: its stored flag, else on for Narration only. */
export function includesAttachments(map: PromptAttachmentsMap, kind: AIRequestType): boolean {
  return map[kind] ?? kind === 'narration';
}

/** Keeps only boolean flags for real prompts. */
export function sanitizePromptAttachments(raw: unknown): PromptAttachmentsMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: PromptAttachmentsMap = {};
  for (const [kind, flag] of Object.entries(raw as Record<string, unknown>)) {
    if (KINDS.includes(kind) && typeof flag === 'boolean') out[kind as AIRequestType] = flag;
  }
  return Object.keys(out).length ? out : undefined;
}
