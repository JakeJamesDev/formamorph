import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { SETTINGS_COPY } from '@/components/modals/settingsCopy';
import { MIN_REASONING_BUDGET_PCT, MAX_REASONING_BUDGET_PCT, budgetReadout } from '@/lib/reasoningEffort';

/**
 * The strength half of a Native Reasoning control: a dropdown of the levels the endpoint accepts, or the
 * budget slider on a target that caps the thought segment by tokens — the built-in engine and LM Studio.
 * Inert while the switch beside it is off, but still showing the remembered value.
 */
export type ReasoningStrength<L extends string> =
  | { kind: 'level'; value: L; options: { value: L; label: string }[]; onChange: (v: L) => void }
  | {
      kind: 'budget'; value: number; tokens?: number; onChange: (v: number) => void;
      /** The target has no base to take a percent of, so the slider is inert while the switch stays live. */
      disabled?: boolean;
    };

/**
 * A Native Reasoning control: the on/off switch, then the strength. The switch is the one lever every prompt
 * and engine share; what sits beside it depends on the engine. `id` labels the switch for assistive tech.
 */
export function ReasoningSwitch<L extends string>({ id, label = SETTINGS_COPY.nativeReasoning.label, enabled, onEnabledChange, strength, disabled, lockedOn }: {
  id: string;
  /** The switch's accessible name, matching the visible label of its row. */
  label?: string;
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
  /** Absent where the target takes neither a level nor a budget, so the switch is the whole control. */
  strength: ReasoningStrength<L> | null;
  disabled?: boolean;
  /** The endpoint refuses to switch reasoning off, so the switch reads checked and takes no clicks. The
   *  strength beside it stays live, and applies on every prompt whose own switch is on. A prompt left off
   *  sends no level at all, so the model spends its own default there. */
  lockedOn?: boolean;
}) {
  const inert = disabled || !(enabled || lockedOn);
  const sliderInert = inert || (strength?.kind === 'budget' && strength.disabled === true);
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 shrink-0 items-center">
        <Checkbox
          id={id}
          checked={lockedOn || enabled}
          disabled={disabled || lockedOn}
          onCheckedChange={(c) => onEnabledChange(c === true)}
          aria-label={label}
        />
      </span>
      {strength?.kind === 'level' && (
        <Select value={strength.value} onValueChange={(v) => strength.onChange(v as L)} disabled={inert}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {strength.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {strength?.kind === 'budget' && (
        <>
          {/* pl-2.5 for the thumb's overhang at the floor — see SamplerControl. */}
          <Slider
            className={`flex-grow pl-2.5${sliderInert ? ' opacity-60' : ''}`}
            value={[strength.value]}
            min={MIN_REASONING_BUDGET_PCT}
            max={MAX_REASONING_BUDGET_PCT}
            step={5}
            disabled={sliderInert}
            onValueChange={(v) => strength.onChange(v[0])}
            aria-label={SETTINGS_COPY.reasoningBudget.label}
          />
          <span className="w-[17ch] shrink-0 whitespace-nowrap text-right text-label tabular-nums">{budgetReadout(strength.value, strength.tokens)}</span>
        </>
      )}
    </div>
  );
}
