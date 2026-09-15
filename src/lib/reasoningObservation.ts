import { extractReasoning } from '@/lib/aiResponse';
import type { ReasoningEffortField } from '@/lib/reasoningEffort';

/**
 * What one endpoint-and-model pair's most recent reply showed about its reasoning. The settings context
 * records it from the AI Stream's events; the capability resolver reads it as one link in its chain.
 */
export interface ReasoningObservation {
  /** Whether the reply carried reasoning in either shape: the stream's own field, or an inline think block. */
  readonly sawReasoning: boolean;
  /** The effort literal the call sent. `null` means the call sent no effort field, so the endpoint chose. */
  readonly effort: ReasoningEffortField | null;
}

/**
 * Whether a reply showed reasoning. Both shapes count: a native model streams its scratchpad in a separate
 * field, and an inline model wraps it in a think block inside the content. Pure.
 */
export function replyCarriedReasoning(reasoningText: string, content: string): boolean {
  if (reasoningText.trim()) return true;
  return extractReasoning(content).length > 0;
}

/** One reply's observation, as the settings context records it. */
export function observeReply(
  reasoningText: string,
  content: string,
  effort: ReasoningEffortField | null | undefined,
): ReasoningObservation {
  return { sawReasoning: replyCarriedReasoning(reasoningText, content), effort: effort ?? null };
}

/**
 * What the observation says about whether the model reasons: `true` when a reply showed reasoning, `false`
 * when a reply came back bare although the call asked for a positive effort, and `null` otherwise. A bare
 * reply under `none` or Model Default answers nothing: neither asked the model to think.
 */
export function observationAnswer(observation: ReasoningObservation | null | undefined): boolean | null {
  if (!observation) return null;
  if (observation.sawReasoning) return true;
  if (observation.effort === null || observation.effort === 'none') return null;
  return false;
}
