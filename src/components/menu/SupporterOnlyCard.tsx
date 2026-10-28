import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PublishOptionSwitch } from '@/components/menu/PublishOptionSwitch';

interface SupporterOnlyCardProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}

/** An admin's opt-in that publishes a new listing Supporter-only and pinned. */
export function SupporterOnlyCard({ checked, onCheckedChange }: SupporterOnlyCardProps) {
  return (
    <div
      className={cn(
        'mt-4 flex items-center gap-3 rounded-lg border p-3 transition-colors',
        checked ? 'border-primary/60 bg-primary/10' : 'bg-card',
      )}
    >
      <Heart className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-label font-semibold">Supporter-Only</div>
        <div className="text-meta text-muted-foreground">
          Limits downloads to Supporters, marks each copy and pins the listing
        </div>
      </div>
      <PublishOptionSwitch
        checked={checked}
        onCheckedChange={onCheckedChange}
        label="Publish Supporter-only"
        onClassName="bg-primary"
      />
    </div>
  );
}
