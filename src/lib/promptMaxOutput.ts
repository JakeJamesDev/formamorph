import type { AIRequestType } from '@/types';
import { TURN_PASS_CAPS } from '@/lib/turnPipeline/turnPasses';

/** One prompt's Max Output override. Off sends the shipped cap; `value` is kept across toggling. */
export interface PromptMaxOutputSetting {
  custom: boolean;
  value: number;
}

/** Per-request Max Output overrides carried on a preset; an absent kind is Auto. */
export type PromptMaxOutputMap = Partial<Record<AIRequestType, PromptMaxOutputSetting>>;

export const MAX_OUTPUT_MIN = 8;
export const MAX_OUTPUT_MAX = 2048;
export const MAX_OUTPUT_STEP = 8;

/** The prompts that show a Max Output row. Each has a shipped cap in the pass cap table. */
export const MAX_OUTPUT_KINDS = [
  'thinking', 'director', 'character', 'storyboard', 'summary', 'diary', 'choices', 'sceneTags', 'discoverEntity',
  'milestoneSelect',
] as const satisfies readonly (AIRequestType & keyof typeof TURN_PASS_CAPS)[];

export type MaxOutputKind = (typeof MAX_OUTPUT_KINDS)[number];

export function isMaxOutputKind(kind: AIRequestType): kind is MaxOutputKind {
  return (MAX_OUTPUT_KINDS as readonly AIRequestType[]).includes(kind);
}

/** The cap a prompt sends while its row is off. */
export function shippedMaxOutput(kind: MaxOutputKind): number {
  return TURN_PASS_CAPS[kind];
}

/** A pass's fixed cap, or `undefined` for a call that has none of its own. */
export function passCap(kind: AIRequestType): number | undefined {
  return (TURN_PASS_CAPS as Partial<Record<AIRequestType, number>>)[kind];
}

/** The cap the row reads: the custom value when on, else the shipped cap. */
export function resolvedMaxOutput(map: PromptMaxOutputMap, kind: MaxOutputKind): number {
  return customMaxOutput(map, kind) ?? shippedMaxOutput(kind);
}

/** Clamps to the slider's range without snapping, so a shipped cap off the step grid survives a share. */
export function clampMaxOutput(value: number): number {
  return Math.max(MAX_OUTPUT_MIN, Math.min(MAX_OUTPUT_MAX, Math.round(value)));
}

/** The prompt's custom cap when its row is on, else `null`. Kinds without a row never override. */
export function customMaxOutput(map: PromptMaxOutputMap, kind: AIRequestType): number | null {
  const setting = map[kind];
  return setting?.custom && isMaxOutputKind(kind) ? setting.value : null;
}

/** Keeps only well-formed entries for kinds with a row, with the value clamped to the slider's range. */
export function sanitizeMaxOutput(raw: unknown): PromptMaxOutputMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: PromptMaxOutputMap = {};
  for (const [kind, s] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMaxOutputKind(kind as AIRequestType) || !s || typeof s !== 'object') continue;
    const { custom, value } = s as Partial<PromptMaxOutputSetting>;
    if (typeof custom !== 'boolean' || typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[kind as MaxOutputKind] = { custom, value: clampMaxOutput(value) };
  }
  return Object.keys(out).length ? out : undefined;
}
