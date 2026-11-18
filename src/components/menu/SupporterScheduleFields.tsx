import { Hint } from '@/components/ui/typography';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublishOptionSwitch } from '@/components/menu/PublishOptionSwitch';
import { formatSupporterDate, MAX_SUPPORTER_DAYS } from '@/lib/supporterEndDate';
import { SCHEDULE_DAYS_RANGE, SCHEDULE_STAGES, type DaysText, type PlannedSchedule } from '@/lib/supporterScheduleEdit';
import { useTierName } from '@/lib/tierNames';
import type { SupporterTier } from '@/types';

interface SupporterScheduleFieldsProps {
  text: DaysText;
  onTextChange: (tier: SupporterTier, next: string) => void;
  goPublic: boolean;
  onGoPublicChange: (next: boolean) => void;
  plan: PlannedSchedule;
}

/** One days field per tier, highest first, with the date each stage opens under it and a switch to go public after the last. */
export function SupporterScheduleFields({ text, onTextChange, goPublic, onGoPublicChange, plan }: SupporterScheduleFieldsProps) {
  const nameOf = useTierName();
  const anyDays = SCHEDULE_STAGES.some((tier) => (text[tier] ?? '').trim() !== '');
  const dateOf = (tier: SupporterTier): string => {
    const opens = plan.stages.find((stage) => stage.tier === tier)?.opensAt;

    return opens ? formatSupporterDate(opens) : 'Not scheduled';
  };

  return (
    <div className="space-y-3">
      <Hint as="div">Days each tier gets the listing before the next one. Leave a tier empty to skip it.</Hint>
      {SCHEDULE_STAGES.map((tier) => {
        const id = `publish-supporter-days-${tier}`;
        const blank = (text[tier] ?? '').trim() === '';
        const invalid = plan.invalid.includes(tier);

        return (
          <div key={tier} className="space-y-1.5">
            <Label htmlFor={id}>{`${nameOf(tier)} Days`}</Label>
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_SUPPORTER_DAYS}
              step={1}
              value={text[tier] ?? ''}
              onChange={(e) => onTextChange(tier, e.target.value)}
              placeholder="Days"
              aria-invalid={invalid}
              className="max-w-40"
            />
            <Hint as="div" role={invalid ? 'alert' : undefined}>
              {invalid
                ? SCHEDULE_DAYS_RANGE
                : anyDays && !blank ? `Opens ${dateOf(tier)}` : anyDays ? `Skipped. Opens ${dateOf(tier)}` : 'Opens at publish'}
            </Hint>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-label font-semibold">Go Public After</div>
          <Hint as="div">
            {!anyDays
              ? 'Enter days to schedule it. With none, the listing stays Supporter-only with no end date'
              : goPublic && plan.publicAt ? `Opens to everyone on ${formatSupporterDate(plan.publicAt)}` : 'Stays Supporter-only with no end date'}
          </Hint>
        </div>
        <PublishOptionSwitch
          checked={goPublic && anyDays}
          onCheckedChange={onGoPublicChange}
          label="Go public after the last stage"
          onClassName="bg-primary"
          disabled={!anyDays}
        />
      </div>
    </div>
  );
}
