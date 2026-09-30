import type { TurnPlan, TurnPlanInput, TurnPassId, TurnPassRecord, TurnStage } from './turnPlan';
import { TURN_PASSES, effectiveActionFor } from './turnPasses';
import { includesAttachments } from '@/lib/promptAttachments';

/**
 * Plan one turn: from plain state, settings and the player's action, decide which passes run, in what
 * order, and whether the post-narration ones are dispatched together. Pure — the same inputs always
 * produce the same plan, and nothing here sends a request.
 */
export function planTurn(input: TurnPlanInput): TurnPlan {
  const writtenNarration = input.writtenNarration?.trim() ? input.writtenNarration : null;
  const due = TURN_PASSES.filter((pass) => pass.isDue(input));
  // The opening turn sends the drawn opening, never the player's images.
  const carriesImages = input.settings.imageAttachments && input.isGameStarted;
  return {
    input,
    isOpeningTurn: !input.isGameStarted,
    effectiveAction: effectiveActionFor(input),
    concurrency: input.settings.concurrentTurnRequests ? 'parallel' : 'serial',
    inlineThinking: input.settings.thinkingMode === 'inline',
    writtenNarration,
    // A written page one needs no router, planner or narrator: each exists only to shape the narration request.
    passes: writtenNarration === null ? due : due.filter((pass) => pass.stage === 'postNarration'),
    attachments: carriesImages ? input.attachments ?? [] : [],
    attachmentPasses: carriesImages
      ? TURN_PASSES.filter((pass) => includesAttachments(input.settings.promptAttachments, pass.type)).map((pass) => pass.id)
      : [],
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
