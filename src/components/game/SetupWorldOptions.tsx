import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Hint, Meta } from '@/components/ui/typography';
import { choiceRowClass } from '@/components/game/setupChoiceRow';
import { optionRange, optionStep, optionValue, snapNumber } from '@/lib/worldOptions';
import type { WorldOption, WorldOptionValueOf, WorldOptionValues } from '@/types';

interface SetupWorldOptionsProps {
  /** The shown Options, in Options-tab order. */
  options: readonly WorldOption[];
  values: WorldOptionValues;
  onChange: (optionId: string, value: WorldOptionValueOf) => void;
  resolveText: (text: string) => string;
}

/** One Option's control: radio rows for a choice, a check row for a boolean, a slider for a number.
 *  With `commitOnRelease`, a slider reports once when the player lets go, not on every step. */
export function OptionControl({ option, value, onChange, resolveText, disabled, commitOnRelease }: {
  option: WorldOption;
  value: WorldOptionValueOf;
  onChange: (value: WorldOptionValueOf) => void;
  resolveText: (text: string) => string;
  disabled?: boolean;
  commitOnRelease?: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => setDrag(null), [value]);
  const name = resolveText(option.name);
  const description = option.playerDescription?.trim() ? resolveText(option.playerDescription) : '';
  const descriptionId = description ? `setup-option-${option.id}-description` : undefined;
  if (option.type === 'boolean') {
    const checked = value === true;
    const id = `setup-option-${option.id}`;
    return (
      <div className={choiceRowClass(checked)}>
        <Checkbox
          id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)}
          aria-describedby={descriptionId} className="mt-0.5 shrink-0" disabled={disabled}
        />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <strong className="block break-words text-label font-semibold">{name}</strong>
          {description && <Hint as="span" id={descriptionId} className="mt-1 block">{description}</Hint>}
        </label>
      </div>
    );
  }
  const heading = (trailing?: string) => (
    <div className="mb-2">
      <div className="flex items-baseline justify-between gap-3">
        <strong className="min-w-0 break-words text-label font-semibold">{name}</strong>
        {trailing !== undefined && <span className="shrink-0 text-label font-semibold tabular-nums">{trailing}</span>}
      </div>
      {description && <Hint id={descriptionId} className="mt-1">{description}</Hint>}
    </div>
  );
  if (option.type === 'number') {
    const n = drag ?? (typeof value === 'number' ? value : snapNumber(option, option.default));
    const { lo, hi } = optionRange(option);
    return (
      <div>
        {heading(String(n))}
        <Slider
          min={lo} max={hi} step={optionStep(option)}
          value={[n]} disabled={disabled}
          onValueChange={([next]) => (commitOnRelease ? setDrag(snapNumber(option, next)) : onChange(snapNumber(option, next)))}
          onValueCommit={commitOnRelease ? ([next]) => { setDrag(null); onChange(snapNumber(option, next)); } : undefined}
          aria-label={name} aria-describedby={descriptionId}
        />
        <Meta as="div" className="mt-1 flex justify-between tabular-nums">
          <span>{lo}</span>
          <span>{hi}</span>
        </Meta>
      </div>
    );
  }
  return (
    <div>
      {heading()}
      <RadioGroup
        value={String(value)} onValueChange={onChange} aria-label={name} aria-describedby={descriptionId} className="space-y-2" disabled={disabled}
      >
        {option.values.map((v) => {
          const id = `setup-option-${option.id}-${v.id}`;
          return (
            <div key={v.id} className={choiceRowClass(value === v.id)}>
              <RadioGroupItem id={id} value={v.id} aria-label={resolveText(v.name)} className="mt-0.5 shrink-0" />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer break-words text-label font-semibold">
                {resolveText(v.name)}
              </label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}

/** The World Options page of the setup screen: every shown Option, each on its current value. */
export function SetupWorldOptions({ options, values, onChange, resolveText }: SetupWorldOptionsProps) {
  return (
    <>
      <Meta as="p" className="mb-1 font-medium tracking-wide">World Setup</Meta>
      <h2 className="mb-3 text-heading font-semibold">World Options</h2>
      <Hint className="mb-4">Choose how this world plays</Hint>
      <div className="space-y-6">
        {options.map((option) => (
          <OptionControl
            key={option.id} option={option} value={optionValue(option, values)}
            onChange={(next) => onChange(option.id, next)} resolveText={resolveText}
          />
        ))}
      </div>
    </>
  );
}
