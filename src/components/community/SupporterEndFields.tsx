import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import {
  MAX_SUPPORTER_DAYS,
  endDateAfterDays,
  formatSupporterDate,
  parseSupporterDays,
} from '@/lib/supporterEndDate';

interface SupporterEndFieldsProps {
  /** The days field's text; blank means no end date. */
  value: string;
  onChange: (next: string) => void;
  /** Distinguishes the label of two fields on screen at once. */
  id: string;
  /** Names what a blank field means. */
  blankHint?: string;
}

/** The optional duration of a Supporter-only listing, with the date it opens to everyone under it. */
export function SupporterEndFields({ value, onChange, id, blankHint = 'No end date' }: SupporterEndFieldsProps) {
  const days = parseSupporterDays(value);
  const blank = value.trim() === '';
  const invalid = !blank && days === null;
  const hint = invalid
    ? `Enter a whole number from 1 to ${MAX_SUPPORTER_DAYS}`
    : days !== null ? `Opens to everyone on ${formatSupporterDate(endDateAfterDays(days))}` : blankHint;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Days Until It Opens</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_SUPPORTER_DAYS}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Days"
        aria-invalid={invalid}
        className="max-w-40"
      />
      <Hint as="div" role={invalid ? 'alert' : undefined}>{hint}</Hint>
    </div>
  );
}
