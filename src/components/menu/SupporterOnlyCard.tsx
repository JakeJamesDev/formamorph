import { Heart } from 'lucide-react';
import { Hint } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { PublishOptionSwitch } from '@/components/menu/PublishOptionSwitch';
import { SupporterEndFields } from '@/components/community/SupporterEndFields';

interface SupporterOnlyCardProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** The days field's text. */
  days: string;
  onDaysChange: (next: string) => void;
}

/** An admin's opt-in that publishes a new listing Supporter-only and pinned, for a set time or without end. */
export function SupporterOnlyCard({ checked, onCheckedChange, days, onDaysChange }: SupporterOnlyCardProps) {
  return (
    <div
      className={cn(
        'mt-4 rounded-lg border p-3 transition-colors',
        checked ? 'border-primary/60 bg-primary/10' : 'bg-card',
      )}
    >
      <div className="flex items-center gap-3">
        <Heart className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="text-label font-semibold">Supporter-Only</div>
          <Hint as="div">Limits downloads to Supporters, marks each copy and pins the listing</Hint>
        </div>
        <PublishOptionSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
          label="Publish Supporter-only"
          onClassName="bg-primary"
        />
      </div>
      {checked && (
        <div className="mt-3 pl-8">
          <SupporterEndFields id="publish-supporter-days" value={days} onChange={onDaysChange} blankHint="No end date" />
        </div>
      )}
    </div>
  );
}
