import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** One staff option in the Moderation popover. */
export interface ModerationOption {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Shown after the label, e.g. how many listings the option would show. */
  count?: number;
  checked: boolean;
  /** The value that counts as "the usual view"; the badge counts options away from it. */
  defaultChecked: boolean;
  /** False hides the option, for a tab it does not apply to. */
  applies: boolean;
  disabled?: boolean;
  help: string;
  onChange: (checked: boolean) => void;
}

/** One popover button for the staff view options; hides itself when no option applies. */
export function ModerationMenu({ options, defaultOpen, className }: {
  options: ModerationOption[];
  defaultOpen?: boolean;
  className?: string;
}): ReactNode {
  const shown = options.filter((o) => o.applies);
  if (shown.length === 0) return null;

  const changed = shown.filter((o) => o.checked !== o.defaultChecked).length;

  return (
    <Popover defaultOpen={defaultOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('relative shrink-0 gap-1', className)}
          aria-label={changed > 0 ? `Moderation, ${changed} changed` : 'Moderation'}
        >
          <ShieldCheck className="h-4 w-4" />
          Moderation
          <ChevronDown className="h-4 w-4" />
          {changed > 0 && (
            <span aria-hidden className={cn(badgeVariants(), 'absolute -right-2 -top-2 h-5 min-w-5 justify-center px-1.5')}>
              {changed}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      {/* Rendered in place: the browser's dialog scroll lock swallows wheel events on a portaled popover. */}
      <PopoverContent portal={false} align="end" side="bottom" className="w-64 space-y-1 p-2">
        {shown.map(({ key, label, icon: Icon, count, checked, disabled, help, onChange }) => (
          <Tip key={key} tip={help} labelsChild={false} side="left">
            <label
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-label select-none',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent',
              )}
            >
              <Checkbox checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} />
              <Icon className="h-4 w-4 shrink-0" />
              {label}{count === undefined ? '' : ` (${count})`}
            </label>
          </Tip>
        ))}
      </PopoverContent>
    </Popover>
  );
}
