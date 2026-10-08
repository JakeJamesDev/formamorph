import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** One action in a split button's menu. */
export interface SplitButtonAction {
  label: string;
  onClick: () => void;
  /** Sized `mr-2 h-4 w-4 shrink-0` by the caller, as the face icon is. */
  icon?: ReactNode;
}

/**
 * A joined pair: the face runs the action the surface calls for, and the chevron opens the rest.
 *
 * Defaults fit the editor footer: outline, small, and a menu that opens upward. The app bar passes
 * `variant="default"` and `side="bottom"`. The face keeps its own icon, since the two footer buttons are
 * told apart by their glyph before their label is read. No `label` draws an icon-only face; its tip names it.
 */
export function SplitButton({
  icon, label, menu, onClick, disabled, faceDisabled, menuLabel, faceTip, tourAnchor,
  variant = 'outline', size = 'sm', side = 'top', align = 'start',
}: {
  icon: ReactNode;
  label?: string;
  menu: SplitButtonAction[];
  onClick: () => void;
  /** Disables the face and the chevron. */
  disabled?: boolean;
  /** Disables the face alone; the menu stays open to use. */
  faceDisabled?: boolean;
  /** The chevron's accessible name, which says what the menu holds. */
  menuLabel: string;
  /** The face's tooltip. On an icon-only face it is also the accessible name. */
  faceTip?: string;
  tourAnchor?: string;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'icon';
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const Chevron = side === 'top' ? ChevronUp : ChevronDown;
  const face = (
    <Button
      variant={variant} size={size} className="rounded-r-none" onClick={onClick}
      disabled={disabled || faceDisabled} data-tour-anchor={tourAnchor}
    >
      {icon}
      {label && <span className="truncate max-w-[14rem]">{label}</span>}
    </Button>
  );
  return (
    <div className="flex">
      {faceTip ? <Tip tip={faceTip} labelsChild={label ? false : undefined}>{face}</Tip> : face}
      <Popover open={open} onOpenChange={setOpen}>
        <Tip tip={menuLabel}>
          <PopoverTrigger asChild>
            <Button
              variant={variant} size={size === 'icon' ? 'default' : size}
              className={cn('rounded-l-none px-2', variant === 'default' ? 'border-l-primary-foreground/25' : 'border-l-0')}
              aria-label={menuLabel} disabled={disabled}
            >
              <Chevron className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent side={side} align={align} className="w-56 p-1">
          <div className="flex flex-col">
            {menu.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="justify-start text-meta h-8"
                onClick={() => { setOpen(false); action.onClick(); }}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
