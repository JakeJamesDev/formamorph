import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Eye, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** What the browser lists for staff; `all` is the usual view. */
export type ModerationView = 'all' | 'quarantined' | 'flaggedLikes';

/** One choice in the Show group. */
export interface ModerationChoice {
  value: ModerationView;
  label: string;
  icon?: LucideIcon;
  /** Shown right-aligned, e.g. how many listings the choice would show. */
  count?: number;
  /** False hides the choice, for a tab it does not apply to. */
  applies: boolean;
  disabled?: boolean;
  help: string;
}

/** The Pin Pending checkbox, kept apart from the Show group. */
export interface PinPendingOption {
  /** False hides it, for a tab it does not apply to. */
  applies: boolean;
  checked: boolean;
  disabled?: boolean;
  help: string;
  onChange: (checked: boolean) => void;
}

const isModerationView = (v: string): v is ModerationView => v === 'all' || v === 'quarantined' || v === 'flaggedLikes';

/** A labeled popover row with its tip. */
function MenuRow({ tip, disabled, children }: { tip: string; disabled?: boolean; children: ReactNode }): ReactNode {
  return (
    <Tip tip={tip} labelsChild={false} side="left">
      <label
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-label select-none',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent',
        )}
      >
        {children}
      </label>
    </Tip>
  );
}

/** One popover button for the staff view options; hides itself when no option applies. */
export function ModerationMenu({ choices, view, onViewChange, pin, defaultOpen, className }: {
  choices: ModerationChoice[];
  view: ModerationView;
  onViewChange: (view: ModerationView) => void;
  pin: PinPendingOption;
  defaultOpen?: boolean;
  className?: string;
}): ReactNode {
  const shown = choices.filter((c) => c.applies);
  const showPin = pin.applies;
  if (shown.length === 0 && !showPin) return null;

  // A view other than All Listings counts one; so does Pin Pending off (its usual state is on).
  const changed = (view !== 'all' ? 1 : 0) + (showPin && !pin.checked ? 1 : 0);

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
      <PopoverContent portal={false} align="end" side="bottom" className="w-64 p-2">
        {shown.length > 0 && (
          <>
            <p className="px-2 pb-1 text-caption font-medium text-muted-foreground">Show</p>
            <RadioGroup value={view} onValueChange={(v) => isModerationView(v) && onViewChange(v)} className="gap-0">
              {shown.map(({ value, label, icon: Icon, count, disabled, help }) => (
                <MenuRow key={value} tip={help} disabled={disabled}>
                  <RadioGroupItem value={value} disabled={disabled} aria-label={count === undefined ? label : `${label} (${count})`} />
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="flex-1">{label}</span>
                  {count !== undefined && <span className="text-muted-foreground">{count}</span>}
                </MenuRow>
              ))}
            </RadioGroup>
          </>
        )}
        {showPin && (
          <>
            {shown.length > 0 && <Separator className="my-2" />}
            <MenuRow tip={pin.help} disabled={pin.disabled}>
              <Checkbox checked={pin.checked} disabled={pin.disabled} onCheckedChange={(c) => pin.onChange(c === true)} />
              <Eye className="h-4 w-4 shrink-0" />
              Pin Pending
            </MenuRow>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
