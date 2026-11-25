import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { SentenceListToken, SentenceToken } from '@/components/ui/sentence-token';
import type { BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { COMPARISON_WORDS } from '@/lib/traitGates';
import type { StatComparison, ThresholdUnit } from '@/types';

const UNITS: readonly { value: ThresholdUnit; label: string; name: string }[] = [
  { value: 'raw', label: 'Raw', name: 'Raw' },
  { value: 'percent', label: '%', name: 'Percent' },
];

const COMPARISON_ROWS: BreadcrumbPickerRow<StatComparison>[] = (Object.entries(COMPARISON_WORDS) as [StatComparison, string][])
  .map(([operator, name]) => ({ key: operator, value: operator, name }));

/**
 * The number box of a numeric Condition. A cleared field or a lone minus sign is a draft the Condition never
 * sees, and a blur puts the Condition's own number back. `accepts` says whether a number would repeat another
 * Condition, which the box then holds as a draft too.
 */
export function ValueInput({ value, accepts, onChange }: { value: number; accepts: (value: number) => boolean; onChange: (value: number) => void }) {
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

/** The comparison of a numeric Condition: a list of six words. An operator `accepts` refuses is disabled. */
export function ComparisonToken({ word, operator, accepts, onPick }: {
  word: string;
  operator: StatComparison;
  accepts: (operator: StatComparison) => boolean;
  onPick: (operator: StatComparison) => void;
}) {
  const rows = COMPARISON_ROWS.map((row) => ({ ...row, disabled: row.value !== operator && !accepts(row.value) }));
  return (
    <SentenceListToken modal label={`Comparison: ${word}`} search="Search comparisons" rows={rows} value={operator} onPick={(next) => { if (next !== operator) onPick(next); }}>
      {word}
    </SentenceListToken>
  );
}

/** A numeric Condition's value: its number, and for a stat the Raw / % switch, in one popover. */
export function NumberValueToken({ text, value, unit, broken, accepts, onNumber, onUnit }: {
  text: string;
  /** Why the value is broken, as its tooltip says it. */
  broken?: string;
  value: number;
  /** A stat's unit; absent for a World Option's whole number. */
  unit?: ThresholdUnit;
  accepts: (next: { value?: number; unit?: ThresholdUnit }) => boolean;
  onNumber: (value: number) => void;
  onUnit?: (unit: ThresholdUnit) => void;
}) {
  return (
    <SentenceToken modal label={`Value: ${text}`} broken={broken} editor={(
      <div className="flex items-center gap-1.5">
        <ValueInput value={value} accepts={(next) => accepts({ value: next })} onChange={onNumber} />
        {unit && onUnit && (
          <ToggleGroup
            type="single"
            aria-label="Unit"
            value={unit}
            onValueChange={(v) => { if (v) onUnit(v as ThresholdUnit); }}
            className="h-8 shrink-0"
          >
            {UNITS.map((u) => (
              <ToggleGroupItem
                key={u.value}
                value={u.value}
                aria-label={u.name}
                disabled={u.value !== unit && !accepts({ unit: u.value })}
                className="h-6 px-2 text-helper"
              >
                {u.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>
    )}>{text}</SentenceToken>
  );
}
