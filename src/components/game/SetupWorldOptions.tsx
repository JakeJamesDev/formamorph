import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Hint, Meta } from '@/components/ui/typography';
import { choiceRowClass } from '@/components/game/setupChoiceRow';
import { optionRange, optionStep, optionValue, snapNumber } from '@/lib/worldOptions';
import type { PresetWorldOption, ValuedWorldOption, WorldOption, WorldOptionValueOf, WorldOptionValues } from '@/types';

interface SetupWorldOptionsProps {
  /** The shown Options, in Options-tab order. */
  options: readonly WorldOption[];
  values: WorldOptionValues;
  onChange: (optionId: string, value: WorldOptionValueOf) => void;
  /** The value of `preset` the setup matches, or null. */
  presetMatch: (preset: PresetWorldOption) => string | null;
  onPreset: (preset: PresetWorldOption, valueId: string) => void;
  resolveText: (text: string) => string;
}

/** One Option's control: radio rows for a choice, a check row for a boolean, a slider for a number.
 *  With `commitOnRelease`, a slider reports once when the player lets go, not on every step. */
export function OptionControl({ option, value, onChange, resolveText, disabled, commitOnRelease }: {
  option: ValuedWorldOption;
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
      <label htmlFor={id} className={choiceRowClass(checked)}>
        <Checkbox
          id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)}
          aria-describedby={descriptionId} className="mt-0.5 shrink-0" disabled={disabled}
        />
        <span className="block min-w-0 flex-1">
          <strong className="block break-words text-label font-semibold">{name}</strong>
          {description && <Hint as="span" id={descriptionId} className="mt-1 block">{description}</Hint>}
        </span>
      </label>
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
            <label key={v.id} htmlFor={id} className={choiceRowClass(value === v.id)}>
              <RadioGroupItem id={id} value={v.id} aria-label={resolveText(v.name)} className="mt-0.5 shrink-0" />
              <span className="block min-w-0 flex-1 break-words text-label font-semibold">
                {resolveText(v.name)}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

/** A Preset's radio rows, each with its description. The selected row is the value the setup matches. */
export function PresetControl({ preset, selected, onPick, resolveText }: {
  preset: PresetWorldOption;
  selected: string | null;
  onPick: (valueId: string) => void;
  resolveText: (text: string) => string;
}) {
  const name = resolveText(preset.name);
  const description = preset.playerDescription?.trim() ? resolveText(preset.playerDescription) : '';
  const descriptionId = description ? `setup-option-${preset.id}-description` : undefined;
  return (
    <div>
      <div className="mb-2">
        <strong className="min-w-0 break-words text-label font-semibold">{name}</strong>
        {description && <Hint id={descriptionId} className="mt-1">{description}</Hint>}
      </div>
      <RadioGroup value={selected ?? ''} onValueChange={onPick} aria-label={name} aria-describedby={descriptionId} className="space-y-2">
        {preset.values.map((v) => {
          const id = `setup-option-${preset.id}-${v.id}`;
          const text = v.description.trim() ? resolveText(v.description) : '';
          return (
            <label key={v.id} htmlFor={id} className={choiceRowClass(selected === v.id)}>
              <RadioGroupItem
                id={id} value={v.id} aria-label={resolveText(v.name)} aria-describedby={text ? `${id}-description` : undefined}
                className="mt-0.5 shrink-0"
              />
              <span className="block min-w-0 flex-1">
                <strong className="block break-words text-label font-semibold">{resolveText(v.name)}</strong>
                {text && <Hint as="span" id={`${id}-description`} className="mt-1 block">{text}</Hint>}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

/** The World Options page of the setup screen: every shown Option, each on its current value. */
export function SetupWorldOptions({ options, values, onChange, presetMatch, onPreset, resolveText }: SetupWorldOptionsProps) {
  return (
    <>
      <Meta as="p" className="mb-1 font-medium tracking-wide">World Setup</Meta>
      <h2 className="mb-3 text-heading font-semibold">World Options</h2>
      <Hint className="mb-4">Choose how this world plays</Hint>
      <div className="space-y-6">
        {options.map((option) => (option.type === 'preset' ? (
          <PresetControl
            key={option.id} preset={option} selected={presetMatch(option)}
            onPick={(valueId) => onPreset(option, valueId)} resolveText={resolveText}
          />
        ) : (
          <OptionControl
            key={option.id} option={option} value={optionValue(option, values)}
            onChange={(next) => onChange(option.id, next)} resolveText={resolveText}
          />
        )))}
      </div>
    </>
  );
}
