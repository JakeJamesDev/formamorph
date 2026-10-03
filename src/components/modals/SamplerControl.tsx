import { HintInfo } from '@/components/SettingsRows';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';

export interface SamplerControlProps {
  id: string;
  label: string;
  hint: string;
  /** Markdown for the row's `ⓘ`, when the setting has a cost or mechanism worth stating. */
  info?: string;
  custom: boolean;
  value: number;
  /** The value shown when off, or undefined when the prompt omits the sampler (endpoint decides). */
  defaultValue: number | undefined;
  /** The endpoint state to show when an omitted sampler has no prompt or local-engine value. */
  fallbackLabel?: 'Endpoint Default' | 'Endpoint Override';
  min: number;
  max: number;
  step: number;
  /** Locks the checkbox and the slider both. */
  disabled?: boolean;
  onCustomChange: (custom: boolean) => void;
  onValueChange: (value: number) => void;
}

/** One custom-sampler override row: a checkbox that enables the override, a slider, and a value readout that
 *  shows the resolved endpoint state while off when the sampler is omitted. On reveals the stored custom value,
 *  which persists across toggling. */
export function SamplerControl({ id, label, hint, info, custom, value, defaultValue, fallbackLabel = 'Endpoint Default', min, max, step, disabled, onCustomChange, onValueChange }: SamplerControlProps) {
  const omitsWhenOff = defaultValue === undefined;
  const shown = custom ? value : (defaultValue ?? value);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={custom} disabled={disabled} onCheckedChange={(c) => onCustomChange(c === true)} />
        <label htmlFor={id} className="text-label">{label}</label>
        <span className="hidden sm:inline text-helper text-muted-foreground">{hint}</span>
        {info && <HintInfo>{info}</HintInfo>}
      </div>
      {/* pl-2.5 is the thumb's own overhang: at `min` it reaches 10px left of the track and a scroll frame
          would clip it. The readout and its gap already clear the right, so the row needs no other padding. */}
      <div className="flex items-center gap-3 pl-2.5">
        <Slider
          className={`flex-grow${custom && !disabled ? '' : ' opacity-60'}`}
          value={[shown]}
          min={min}
          max={max}
          step={step}
          disabled={disabled || !custom}
          onValueChange={(v) => onValueChange(v[0])}
          aria-label={label}
        />
        <span className="w-[17ch] shrink-0 whitespace-nowrap text-right text-label tabular-nums">
          {custom || !omitsWhenOff ? shown.toFixed(2) : <span className="text-muted-foreground not-italic">{fallbackLabel}</span>}
        </span>
      </div>
    </div>
  );
}
