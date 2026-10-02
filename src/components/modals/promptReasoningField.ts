import {
  promptReasoningLevelOptions, reasoningRuledOut, reasoningLevelControl, reasoningOffRefused, reasoningAwaitingProof,
  reasoningBudget, type PromptReasoningSetting, type ReasoningCapability,
} from '@/lib/reasoningEffort';
import { reasoningDialectTakesBudget, reasoningDialectBudgetFloor } from '@/lib/reasoningDialect';
import type { AIRequestType } from '@/types';

export interface PromptReasoningFieldProps {
  setting: PromptReasoningSetting;
  onChange: (v: PromptReasoningSetting) => void;
  options: { value: PromptReasoningSetting['level']; label: string }[];
  /** The budget percent and its setter when the target takes a token budget; absent otherwise. */
  budget: { value: number; set: (v: number) => void; tokens?: number; disabled: boolean } | null;
  /** Whether the target honors the effort level, so the dropdown is worth showing. */
  level: boolean;
  /** The endpoint refuses to switch reasoning off, so the switch reads checked and locked. */
  lockedOn?: boolean;
  disabled?: boolean;
}

/** What the reasoning field reads off a resolved endpoint. */
export interface ReasoningFieldTarget {
  reasoning: ReasoningCapability;
  localEngine: boolean;
  /** The endpoint's Max Output, the base the budget scales from. */
  maxTokens: number | undefined;
}

export interface PromptReasoningFieldInput {
  target: ReasoningFieldTarget;
  kind: AIRequestType;
  setting: PromptReasoningSetting;
  budgetPct: number;
  /** The call never sends native reasoning, as Inline narration does not. */
  suppressed: boolean;
  onChange: (v: PromptReasoningSetting) => void;
  onBudgetChange: (pct: number) => void;
}

/**
 * The reasoning field's props for one call, or `null` where no field is drawn: a suppressed call, and an
 * external endpoint whose record rules reasoning out or still awaits proof. The local engine always draws one.
 */
export function promptReasoningFieldProps(input: PromptReasoningFieldInput): Omit<PromptReasoningFieldProps, 'disabled'> | null {
  const { target, kind, setting, budgetPct, suppressed, onChange, onBudgetChange } = input;
  const capability = target.reasoning;
  // A record rules reasoning out when the model is known not to reason, or when the endpoint accepts no
  // reasoning_effort literal at all (not even `none`). An unanswered record keeps the field showing. A
  // dialect that publishes nothing about its own reasoning, such as a vLLM server, has nothing worth drawing
  // until one reply proves it separates its reasoning.
  const applicable = !suppressed
    && (target.localEngine || (!reasoningRuledOut(capability) && !reasoningAwaitingProof(capability)));
  if (!applicable) return null;
  // The readout's tokens come from the routed endpoint's Max Output, the same base the request reads. With
  // no base, a floor dialect still sends its floor.
  const tokens = reasoningBudget({
    effort: 'auto', kind, budgets: { [kind]: budgetPct }, base: target.maxTokens, answerCap: undefined,
    floor: reasoningDialectBudgetFloor(capability.dialect),
  }).budget ?? undefined;
  return {
    setting,
    onChange,
    options: promptReasoningLevelOptions(capability, setting.level),
    lockedOn: reasoningOffRefused(capability),
    // Both halves follow the dialect's row: the slider where it names a budget field and the record says the
    // endpoint takes one, the dropdown where it carries an effort literal and the record lists a strength to
    // pick. The built-in engine's row names no level field, so its dropdown would be inert and is not drawn.
    budget: capability.budget && reasoningDialectTakesBudget(capability.dialect)
      ? { value: budgetPct, set: onBudgetChange, tokens, disabled: target.maxTokens === undefined }
      : null,
    level: reasoningLevelControl(capability),
  };
}
