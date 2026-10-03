import { HintInfo } from '@/components/SettingsRows';
import { SETTINGS_COPY, REASONING_NOTES } from '@/components/modals/settingsCopy';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { MIN_REASONING_BUDGET_PCT, MAX_REASONING_BUDGET_PCT, budgetReadout, type PromptReasoningSetting } from '@/lib/reasoningEffort';
import { MAX_OUTPUT_MIN, MAX_OUTPUT_MAX, MAX_OUTPUT_STEP } from '@/lib/promptMaxOutput';
import { ReasoningSwitch, type ReasoningStrength } from './ReasoningSwitch';
import type { PromptReasoningFieldProps, ReasoningFieldCopy } from './promptReasoningField';

/** A prompt's Max Output row. Off reads Auto with the shipped cap; on, the slider sets the cap in tokens. */
export interface MaxOutputControlProps {
  custom: boolean;
  value: number;
  shipped: number;
  disabled?: boolean;
  onCustomChange: (custom: boolean) => void;
  onValueChange: (value: number) => void;
}
export function MaxOutputControl({ custom, value, shipped, disabled, onCustomChange, onValueChange }: MaxOutputControlProps) {
  const shown = custom ? value : shipped;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id="promptMaxOutput" checked={custom} disabled={disabled} onCheckedChange={(c) => onCustomChange(c === true)} />
        <label htmlFor="promptMaxOutput" className="text-label">{SETTINGS_COPY.promptMaxOutput.label}</label>
        <span className="hidden sm:inline text-helper text-muted-foreground">{SETTINGS_COPY.promptMaxOutput.description}</span>
      </div>
      {/* pl-2.5 for the thumb's overhang at the floor — see SamplerControl. */}
      <div className="flex items-center gap-3 pl-2.5">
        <Slider
          className={`flex-grow${custom && !disabled ? '' : ' opacity-60'}`}
          value={[shown]}
          min={MAX_OUTPUT_MIN}
          max={MAX_OUTPUT_MAX}
          step={MAX_OUTPUT_STEP}
          disabled={disabled || !custom}
          onValueChange={(v) => onValueChange(v[0])}
          aria-label={SETTINGS_COPY.promptMaxOutput.label}
        />
        <span className="w-[17ch] shrink-0 whitespace-nowrap text-right text-label tabular-nums">{custom ? `${shown} tok` : `Auto · ${shown} tok`}</span>
      </div>
    </div>
  );
}

/**
 * A prompt's Native Reasoning control: its switch, then Global or its own level, and on a target that takes a
 * token budget the Reasoning Budget slider under it. Both go out on the wire there, so both are shown; the one
 * switch governs both. Global follows Settings → Output → Native Reasoning, switch included. The built-in
 * engine ignores the effort field, so it shows the slider alone (`level` false).
 */
export function PromptReasoningField({ setting, onChange, options, budget, level, lockedOn, disabled, copy = SETTINGS_COPY.promptNativeReasoning, id = 'promptReasoning', switchLabel }: PromptReasoningFieldProps) {
  const inert = disabled || !(setting.enabled || lockedOn);
  const sliderInert = inert || budget?.disabled === true;
  const levelStrength: ReasoningStrength<PromptReasoningSetting['level']> = {
    kind: 'level', value: setting.level, options, onChange: (next) => onChange({ ...setting, level: next }),
  };
  const budgetStrength: ReasoningStrength<PromptReasoningSetting['level']> | null = budget
    ? { kind: 'budget', value: budget.value, tokens: budget.tokens, onChange: budget.set, disabled: budget.disabled }
    : null;
  // The field is named for what it actually offers: the budget where that is the only strength, and the
  // switch's own name where the target takes a level, or takes neither and the switch stands alone.
  const lead: ReasoningFieldCopy | null = copy && (level || !budgetStrength ? copy : SETTINGS_COPY.reasoningBudget);
  return (
    <div className="flex flex-col gap-1">
      {lead && (
        <>
          <div className="flex items-center gap-1.5">
            <label htmlFor={id} className="text-label">{lead.label}</label>
            {lead.info && <HintInfo>{lead.info}</HintInfo>}
          </div>
          <span className="text-helper text-muted-foreground">{lead.description}</span>
        </>
      )}
      <ReasoningSwitch
        id={id}
        label={switchLabel}
        enabled={setting.enabled}
        onEnabledChange={(enabled) => onChange({ ...setting, enabled })}
        disabled={disabled}
        lockedOn={lockedOn}
        strength={level ? levelStrength : budgetStrength}
      />
      {lockedOn && <p className="text-helper text-muted-foreground">{REASONING_NOTES.always}</p>}
      {level && budgetStrength && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-label">{SETTINGS_COPY.reasoningBudget.label}</span>
            <HintInfo>{SETTINGS_COPY.reasoningBudget.info}</HintInfo>
          </div>
          <span className="text-helper text-muted-foreground">{SETTINGS_COPY.reasoningBudget.description}</span>
          {/* Same switch as above: the row only carries the slider, flush with every other track. */}
          <div className="flex items-center gap-3 pl-2.5">
            <Slider
              className={`flex-grow${sliderInert ? ' opacity-60' : ''}`}
              value={[budgetStrength.value]}
              min={MIN_REASONING_BUDGET_PCT}
              max={MAX_REASONING_BUDGET_PCT}
              step={5}
              disabled={sliderInert}
              onValueChange={(v) => budgetStrength.onChange(v[0])}
              aria-label={SETTINGS_COPY.reasoningBudget.label}
            />
            <span className="w-[17ch] shrink-0 whitespace-nowrap text-right text-label tabular-nums">{budgetReadout(budgetStrength.value, budgetStrength.tokens)}</span>
          </div>
        </div>
      )}
      {budget?.disabled && <p className="text-helper text-muted-foreground">{REASONING_NOTES.noBudgetBase}</p>}
    </div>
  );
}
