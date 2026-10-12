import type { AIRequestType, Entity, RequestMessage } from "@/types";
import { renderPromptTemplate } from "@/lib/promptTemplate";
import { resolveEntityTexts, type ResolveEntityText } from "@/lib/resolveWorldNames";
import { buildDiaryUserMessage } from "@/lib/stagedPlanning";
import { TURN_PASS_CAPS } from "@/lib/turnPipeline/turnPasses";

// The request the game view builds by hand: the idle diary drainer. A pure body lifted out of the view so a
// test can call it.

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

const DIARY_MAX_TOKENS = TURN_PASS_CAPS.diary;

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
