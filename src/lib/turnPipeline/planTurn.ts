import type { TurnPlan, TurnPlanInput, TurnPassId, TurnPassRecord, TurnStage } from './turnPlan';
import { TURN_PASSES, effectiveActionFor } from './turnPasses';

/**
 * Plan one turn: from plain state, settings and the player's action, decide which passes run, in what
 * order, and whether the post-narration ones are dispatched together. Pure — the same inputs always
 * produce the same plan, and nothing here sends a request.
 */
export function planTurn(input: TurnPlanInput): TurnPlan {
  return {
    input,
    isOpeningTurn: !input.isGameStarted,
    effectiveAction: effectiveActionFor(input),
    concurrency: input.settings.concurrentTurnRequests ? 'parallel' : 'serial',
    inlineThinking: input.settings.thinkingMode === 'inline',
    passes: TURN_PASSES.filter((pass) => pass.isDue(input)),
  };
}

/** The plan's passes for one stage, in dispatch order. */
export function passesInStage(plan: TurnPlan, stage: TurnStage): TurnPassRecord[] {
  return plan.passes.filter((pass) => pass.stage === stage);
}

/** Whether the plan dispatches a given pass this turn. */
export function planHasPass(plan: TurnPlan, id: TurnPassId): boolean {
  return plan.passes.some((pass) => pass.id === id);
}
