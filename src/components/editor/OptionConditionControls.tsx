import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OperatorSelect, ValueInput } from '@/components/editor/StatConditionControls';
import type { OptionRequirement, WorldOption } from '@/types';

/**
 * The controls a World Option Condition chip carries: a choice's value dropdown, or a number's operator and
 * whole number. A boolean carries none; its chip text says on or off. `accepts` says whether a replacement
 * would repeat another Condition in the row; such a value is disabled and such a number stays a draft.
 */
export function OptionConditionControls({ option, requirement, accepts, onChange }: {
  option: WorldOption;
  requirement: OptionRequirement;
  accepts: (next: OptionRequirement) => boolean;
  onChange: (next: OptionRequirement) => void;
}) {
  if (option.type === 'choice') {
    const pick = (valueId: string): OptionRequirement =>
      ({ ...requirement, valueId, valueName: option.values.find((v) => v.id === valueId)?.name ?? requirement.valueName });
    return (
      <Select value={requirement.valueId} onValueChange={(v) => onChange(pick(v))}>
        <SelectTrigger size="sm" aria-label="Value" className="h-6 w-auto max-w-40 shrink-0 gap-1 px-2 text-helper">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-0">
          {option.values.map((v) => (
            <SelectItem key={v.id} value={v.id} disabled={v.id !== requirement.valueId && !accepts(pick(v.id))} className="text-helper">
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (option.type === 'number') {
    return (
      <>
        <OperatorSelect
          value={requirement.operator ?? '='}
          accepts={(operator) => accepts({ ...requirement, operator })}
          onChange={(operator) => onChange({ ...requirement, operator })}
        />
        <ValueInput
          value={requirement.value ?? 0}
          accepts={(value) => Number.isInteger(value) && accepts({ ...requirement, value })}
          onChange={(value) => onChange({ ...requirement, value })}
        />
      </>
    );
  }
  return null;
}
