import type { AIRequestType, ChatMessage, Entity, RequestMessage } from "@/types";
import { renderPromptTemplate } from "@/lib/promptTemplate";
import { resolveEntityTexts, type ResolveEntityText } from "@/lib/resolveWorldNames";
import { buildDiaryUserMessage } from "@/lib/stagedPlanning";
import type { StatRequestSnapshot } from "@/lib/statRequest";
import type { TurnPassRequest } from "@/lib/turnPipeline/turnPlan";
import { TURN_PASS_CAPS, choicesSystemPrompt, statUpdatesRequest, summaryUserMessage } from "@/lib/turnPipeline/turnPasses";

// The requests the game view builds by hand: the idle digest and diary drainers and the choices and stats
// re-rolls. Pure bodies lifted out of the view so a test can call them.

/** A hand-built request as the view's request path takes it, before the abort signal rides on. */
export interface HandBuiltRequest {
  systemPrompt: string;
  messages: RequestMessage[];
  type: AIRequestType;
  maxTokens: number;
  silent?: boolean;
  attachTurnId?: string;
  quiet?: boolean;
}

// Each completed turn is digested as soon as it commits, so a summary is ready for the next turn's context.
const DIGEST_MAX_TOKENS = TURN_PASS_CAPS.summary;
const DIARY_MAX_TOKENS = TURN_PASS_CAPS.diary;

/** The silent digest of one stored turn. `playerAction` is the paired user message as stored. */
export const digestRequest = (args: {
  summaryPrompt: string;
  summaryUserPrompt: string;
  ctx: Record<string, string>;
  playerAction: string;
  narration: string;
  turnId: string;
}): HandBuiltRequest => ({
  systemPrompt: renderPromptTemplate(args.summaryPrompt, args.ctx),
  messages: [{ role: "user", content: summaryUserMessage(args.summaryUserPrompt, args.playerAction, args.narration) }],
  type: "summary",
  maxTokens: DIGEST_MAX_TOKENS,
  silent: true,
  attachTurnId: args.turnId, // so the viewer shows it under the turn it summarizes
});

/** The silent diary entry for one participant of a stored turn. An unknown name carries no entity text. */
export const diaryRequest = (args: {
  diaryPrompt: string;
  ctx: Record<string, string>;
  name: string;
  narration: string;
  turnId: string;
  allEntities: readonly Entity[];
  resolveEntityText: ResolveEntityText;
}): HandBuiltRequest => {
  const found = args.allEntities.find((e) => e.name.trim().toLowerCase() === args.name.trim().toLowerCase());
  // The request sends the entity's text as it stands, so it resolves here with its owner.
  const entity = found && resolveEntityTexts([found], args.resolveEntityText)[0];
  return {
    systemPrompt: renderPromptTemplate(args.diaryPrompt, args.ctx),
    messages: [{ role: "user", content: buildDiaryUserMessage({ name: args.name, entity, narration: args.narration }) }],
    type: "diary",
    maxTokens: DIARY_MAX_TOKENS,
    silent: true,
    attachTurnId: args.turnId, // so the viewer shows it under the turn it records
  };
};

/** The choices re-roll. `quiet` suppresses the status label. */
export const choicesRerollRequest = (args: {
  choicesPrompt: string;
  choicesUserPrompt: string;
  language: string;
  ctx: Record<string, string>;
  sceneEntityTokens: Record<string, string>;
  action: string;
  narration: string;
  quiet: boolean;
}): HandBuiltRequest => ({
  systemPrompt: choicesSystemPrompt(args.choicesPrompt, args.language, { ...args.ctx, ...args.sceneEntityTokens }),
  messages: [{ role: "user", content: renderPromptTemplate(args.choicesUserPrompt, { "<PLAYER ACTION>": args.action, "<NARRATION>": args.narration }) }],
  type: "choices",
  maxTokens: TURN_PASS_CAPS.choices,
  quiet: args.quiet,
});

/** The stats re-roll. `quiet` suppresses the status label. */
export const statsRerollRequest = (args: {
  statUpdatesPrompt: string;
  statUpdatesUserPrompt: string;
  ctx: Record<string, string>;
  action: string;
  narration: string;
  statCount: number;
  statRequest: StatRequestSnapshot;
  quiet: boolean;
}): TurnPassRequest<ChatMessage> =>
  statUpdatesRequest(
    { system: args.statUpdatesPrompt, user: args.statUpdatesUserPrompt },
    { ctx: args.ctx, action: args.action, narration: args.narration },
    { statCount: args.statCount, statRequest: args.statRequest, quiet: args.quiet },
  );
