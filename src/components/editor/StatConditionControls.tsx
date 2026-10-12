import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { StatComparison, StatRequirement, ThresholdUnit } from '@/types';

const OPERATORS: readonly { value: StatComparison; name: string }[] = [
  { value: '>', name: 'Greater than' },
  { value: '<', name: 'Less than' },
  { value: '>=', name: 'Greater than or equal to' },
  { value: '<=', name: 'Less than or equal to' },
  { value: '=', name: 'Equal to' },
  { value: '≠', name: 'Not equal to' },
];

const UNITS: readonly { value: ThresholdUnit; label: string; name: string }[] = [
  { value: 'raw', label: 'Raw', name: 'Raw' },
  { value: 'percent', label: '%', name: 'Percent' },
];

const ITEM_CLASS = 'h-6 px-2 text-helper';

/**
 * The value box of a stat Condition. A cleared field or a lone minus sign is a draft the Condition never
 * sees, and a blur puts the Condition's own number back. `accepts` says whether a number would repeat another
 * Condition, which the box then holds as a draft too.
 */
function ValueInput({ value, accepts, onChange }: { value: number; accepts: (value: number) => boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  // A change from outside, such as an undo, replaces the draft.
  useEffect(() => setDraft((prev) => (Number(prev) === value ? prev : String(value))), [value]);
  return (
    <Input
      type="number"
      size="sm"
      aria-label="Value"
      className="h-6 w-20 shrink-0 px-2"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = e.target.valueAsNumber;
        if (Number.isFinite(next) && accepts(next)) onChange(next);
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}

/**
 * The controls a stat Condition chip carries: a segmented operator, the number it compares to, and whether
 * that number is in raw units or a percent of the stat's span. `accepts` says whether a replacement would
 * repeat another Condition in the row; such an operator stays off and such a number stays a draft.
 */
export function StatConditionControls({ requirement, accepts, onChange }: {
  requirement: StatRequirement;
  accepts: (next: StatRequirement) => boolean;
  onChange: (next: StatRequirement) => void;
}) {
  return (
    <>
      <ToggleGroup
        type="single"
        aria-label="Operator"
        value={requirement.operator}
        onValueChange={(v) => { if (v) onChange({ ...requirement, operator: v as StatComparison }); }}
        className="h-8 shrink-0"
      >
        {OPERATORS.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            aria-label={o.name}
            disabled={o.value !== requirement.operator && !accepts({ ...requirement, operator: o.value })}
            className={ITEM_CLASS}
          >
            {o.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ValueInput
        value={requirement.value}
        accepts={(value) => accepts({ ...requirement, value })}
        onChange={(value) => onChange({ ...requirement, value })}
      />
      <ToggleGroup
        type="single"
        aria-label="Unit"
        value={requirement.unit}
        onValueChange={(v) => { if (v) onChange({ ...requirement, unit: v as ThresholdUnit }); }}
        className="h-8 shrink-0"
      >
        {UNITS.map((u) => (
          <ToggleGroupItem
            key={u.value}
            value={u.value}
            aria-label={u.name}
            disabled={u.value !== requirement.unit && !accepts({ ...requirement, unit: u.value })}
            className={ITEM_CLASS}
          >
            {u.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  );
}
