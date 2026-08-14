import { buildBandedHistory, type BandTurn } from "../turnBanding";
import { estimateTokens } from "../memoryUtils";
import { renderPromptTemplate } from "../promptTemplate";
import type { MemoryNote } from "../memoryOverrides";
import { TURN_PASS_CAPS } from "./turnPasses";

export interface PlannerBandInput {
  turns: BandTurn[];
  /** The planner prompt, chips unresolved, plus the context to render it against — its size sets the band budget. */
  template: string;
  ctx: Record<string, string>;
  /** The planner's own endpoint window: routing it to a smaller model must shrink its band, not narration's. */
  contextWindow: number;
  verbatimFloor: number;
  milestoneDrop: Set<string> | null;
  recapPrompt: string;
  relevanceScores: Map<string, number> | null;
  bandCap: number;
  /** The incumbent band, read-only here — only the live narration call advances the sticky set. */
  stickyIds: Set<string> | null;
  notes: MemoryNote[];
  /** Narration's last story, used when the planner's own band has no assistant message. */
  fallbackLastStory: string;
}

export interface PlannerBand {
  recap: string;
  lastStory: string;
}

/**
 * The precall planner's own history band. Planning needs the least context: the immediate turn verbatim,
 * everything older summarized — so the band rebuilds with no rehydration at all, and the caller's floor.
 * The drop set is window-exact regardless of this stage's narrower floor, so it is the same filtered memory
 * narration sees.
 */
export function buildPlannerBand(input: PlannerBandInput): PlannerBand {
  const planner = buildBandedHistory({
    turns: input.turns,
    contextWindow: input.contextWindow,
    promptTokens: estimateTokens(renderPromptTemplate(input.template, input.ctx).length),
    maxTokens: TURN_PASS_CAPS.thinking,
    verbatimFloor: input.verbatimFloor,
    keywords: [],
    actionEntities: [],
    rehydrateCap: 0,
    maxRehydrations: 0,
    milestoneDrop: input.milestoneDrop,
    recapPrompt: input.recapPrompt,
    relevanceScores: input.relevanceScores,
    bandCap: input.bandCap,
    stickyIds: input.stickyIds,
    notes: input.notes,
  });
  return {
    recap: planner.recap,
    lastStory:
      [...planner.messages].reverse().find((m) => m.role === "assistant")?.content || input.fallbackLastStory,
  };
}
