import {
  DEFAULT_REASONING_SETTING, promptReasoningLevelOptions, reasoningRuledOut, reasoningLevelControl, reasoningOffRefused,
  reasoningAwaitingProof, reasoningBudget, resolveReasoningSetting, resolveRequestReasoning, thinkingRoomFor,
  type PromptReasoningSetting, type ReasoningCapability, type ReasoningSetting, type ThinkingRoom,
} from '@/lib/reasoningEffort';
import { reasoningDialectBudgetFloor, reasoningDialectTakesBudget } from '@/lib/reasoningDialect';
import type { AIRequestType } from '@/types';

/** The label, line and ⓘ of a reasoning field. */
export interface ReasoningFieldCopy { label: string; description: string; info?: string }

export interface PromptReasoningFieldProps {
  setting: PromptReasoningSetting;
  onChange: (v: PromptReasoningSetting) => void;
  options: { value: PromptReasoningSetting['level']; label: string }[];
  /** The budget percent and its setter where the target takes a token budget the endpoint's Max Output can scale. */
  budget: { value: number; set: (v: number) => void; tokens?: number } | null;
  /** The strength and its Thinking Room where no budget slider shows, for the readout beside the strength. */
  room: ThinkingRoom | null;
  /** Whether the target honors the effort level, so the dropdown is worth showing. */
  level: boolean;
  /** The endpoint refuses to switch reasoning off, so the switch reads checked and locked. */
  lockedOn?: boolean;
  /** The endpoint-wide switch is off, so the prompt sends none and its own setting waits, inert. */
  globalOff?: boolean;
  disabled?: boolean;
  /** The label, line and ⓘ in place of the prompt copy, where the target takes a level or neither strength. Null
   *  draws none, for a settings row that carries its own. */
  copy?: ReasoningFieldCopy | null;
  /** The switch's element id, so two fields never share one. */
  id?: string;
  /** The switch's accessible name, where the row around the field carries the visible label. */
  switchLabel?: string;
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
  /** The endpoint-wide switch and strength a prompt set to Global follows. Model Default where the caller has none. */
  global?: ReasoningSetting;
  /** The call never sends native reasoning, as Inline narration does not. */
  suppressed: boolean;
  /** Draws the field while the dialect awaits proof, as the Output row does. */
  showAwaitingProof?: boolean;
  onChange: (v: PromptReasoningSetting) => void;
  onBudgetChange: (pct: number) => void;
}

/**
 * The reasoning field's props for one call, or `null` where no field is drawn: a suppressed call, and an
 * external endpoint whose record rules reasoning out or still awaits proof. The local engine always draws one.
 */
export function promptReasoningFieldProps(input: PromptReasoningFieldInput): Omit<PromptReasoningFieldProps, 'disabled'> | null {
  const { target, kind, setting, budgetPct, global = DEFAULT_REASONING_SETTING, suppressed, showAwaitingProof = false, onChange, onBudgetChange } = input;
  const capability = target.reasoning;
  // An unanswered record keeps the field; a proof-needing dialect (vLLM) waits for its first reply.
  const applicable = !suppressed
    && (target.localEngine || (!reasoningRuledOut(capability) && (showAwaitingProof || !reasoningAwaitingProof(capability))));
  if (!applicable) return null;
  // The same base the request reads; with none, a floor dialect still sends its floor.
  const tokens = reasoningBudget({
    effort: 'auto', kind, budgets: { [kind]: budgetPct }, base: target.maxTokens, answerCap: undefined,
    floor: reasoningDialectBudgetFloor(capability.dialect),
  }).budget ?? undefined;
  const slider = capability.budget === true && reasoningDialectTakesBudget(capability.dialect);
  const level = reasoningLevelControl(capability);
  const scalable = target.maxTokens !== undefined;
  // The request's own fold, read as if the switch were on, so a row that is off shows its remembered room.
  const strength = resolveRequestReasoning(
    kind, { [kind]: setting.level }, resolveReasoningSetting(global), 'off', capability, { prompts: { [kind]: setting }, global },
  );
  const lockedOn = reasoningOffRefused(capability);
  // A slider target with no base, or a level target with no slider; no other target shows a strength to read beside.
  const room = strength !== 'none' && ((slider && !scalable) || (!slider && level))
    ? thinkingRoomFor(strength, slider ? reasoningDialectBudgetFloor(capability.dialect) : 0)
    : null;
  return {
    setting,
    onChange,
    options: promptReasoningLevelOptions(capability, setting.level),
    lockedOn,
    // An endpoint that refuses off reasons whatever the switch says, so the prompt keeps its own control.
    globalOff: !global.enabled && !lockedOn,
    // Each half follows the dialect's row and the record; the engine names no level field, so no dropdown.
    budget: slider && scalable ? { value: budgetPct, set: onBudgetChange, tokens } : null,
    room,
    level,
  };
}
