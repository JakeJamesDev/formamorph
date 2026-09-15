import { extractReasoning } from '@/lib/aiResponse';
import type { ReasoningCapability, ReasoningCapabilitySource, ReasoningEffortField } from '@/lib/reasoningEffort';

/**
 * What one endpoint-and-model pair's most recent reply showed about its reasoning. The settings context
 * records it from the AI Stream's events; the capability resolver reads it as one link in its chain.
 */
export interface ReasoningObservation {
  /** Whether the reply carried reasoning in either shape: the stream's own field, or an inline think block. */
  readonly sawReasoning: boolean;
  /** Whether the reply parted its reasoning out into a field of its own. A server that does this runs a
   *  reasoning parser, which no model list advertises, so it is the one proof some dialects wait for. */
  readonly sawSeparateReasoning: boolean;
  /** The effort literal the call sent. `null` means the call sent no effort field, so the endpoint chose. */
  readonly effort: ReasoningEffortField | null;
}

/**
 * Whether a reply parted its reasoning out into a field beside the content. A think block inside the content
 * is not this: it says the model thought, not that the server parsed the thinking out. Pure.
 */
export function replySeparatedReasoning(reasoningText: string): boolean {
  return reasoningText.trim().length > 0;
}

/**
 * Whether a reply showed reasoning. Both shapes count: a native model streams its scratchpad in a separate
 * field, and an inline model wraps it in a think block inside the content. Pure.
 */
export function replyCarriedReasoning(reasoningText: string, content: string): boolean {
  if (replySeparatedReasoning(reasoningText)) return true;
  return extractReasoning(content).length > 0;
}

/** One reply's observation, as the settings context records it. */
export function observeReply(
  reasoningText: string,
  content: string,
  effort: ReasoningEffortField | null | undefined,
): ReasoningObservation {
  return {
    sawReasoning: replyCarriedReasoning(reasoningText, content),
    sawSeparateReasoning: replySeparatedReasoning(reasoningText),
    effort: effort ?? null,
  };
}

/**
 * Whether the observation settles the reasons question. A reply that showed reasoning says the model thinks.
 * A reply that came back bare although the call asked for a positive effort says it does not. A bare reply
 * under `none` or Model Default settles nothing, because neither asked the model to think.
 */
export function observationAnswer(observation: ReasoningObservation | null | undefined): boolean | null {
  if (!observation) return null;
  if (observation.sawReasoning) return true;
  if (observation.effort === null || observation.effort === 'none') return null;
  return false;
}

/** The sources one reply may correct. An advertisement, the catalog and the engine's own answer outrank it. */
const OUTRANKED_BY_OBSERVATION: readonly ReasoningCapabilitySource[] = ['observed', 'probe', 'cache'];

/**
 * Whether a reply is allowed to answer the reasons question for this record. An unanswered record is always
 * open. An answered one is open only where the source that answered ranks below a reply, so a probe's guess
 * and a stale cache entry both give way while an advertisement stands.
 */
export function observationMayCorrect(capability: ReasoningCapability | null | undefined): boolean {
  if (!capability || capability.reasons === null) return true;
  const source = capability.sources.reasons;
  return source === undefined || OUTRANKED_BY_OBSERVATION.includes(source);
}
