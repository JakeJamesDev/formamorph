import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** One action in a split button's menu. */
export interface SplitButtonAction {
  label: string;
  onClick: () => void;
  /** Sized `mr-2 h-4 w-4 shrink-0` by the caller, as the face icon is. */
  icon?: ReactNode;
  /** Draws a checkbox row in place of the icon. `onClick` toggles it, and the menu stays open. */
  checked?: boolean;
}

const MENU_ITEM = 'justify-start text-meta h-8';

/**
 * A joined pair: the face runs the action the surface calls for, and the chevron opens the rest.
 *
 * Defaults fit the editor footer: outline, small, and a menu that opens upward. The app bar passes
 * `variant="default"` and `side="bottom"`. The face keeps its own icon, since the two footer buttons are
 * told apart by their glyph before their label is read. No `label` draws an icon-only face; its tip names it.
 * `children` draws a face whose content changes, such as Save's states, in place of the icon and label.
 */
export function SplitButton({
  icon, label, children, menu, onClick, disabled, faceDisabled, faceAriaDisabled, faceClassName, menuLabel, faceTip,
  faceDescription, tourAnchor, variant = 'outline', size = 'sm', side = 'top', align = 'start',
}: {
  icon?: ReactNode;
  /** The face's visible text. With `children` it still marks the face as named by its text, not its tip. */
  label?: string;
  children?: ReactNode;
  menu: SplitButtonAction[];
  onClick: () => void;
  /** Disables the face and the chevron. */
  disabled?: boolean;
  /** Disables the face alone; the menu stays open to use. */
  faceDisabled?: boolean;
  /** Keeps the face's full look and its tip but takes no click, for a face that is busy or shows a result. */
  faceAriaDisabled?: boolean;
  faceClassName?: string;
  /** The chevron's accessible name, which says what the menu holds. */
  menuLabel: string;
  /** The face's tooltip. On an icon-only face it is also the accessible name. */
  faceTip?: string;
  /** The face's accessible description, read with its name. A tip shows only on hover, so it is not one. */
  faceDescription?: string;
  tourAnchor?: string;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'icon';
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const Chevron = side === 'top' ? ChevronUp : ChevronDown;
  const face = (
    <Button
      variant={variant} size={size} className={cn('rounded-r-none', faceClassName)}
      onClick={() => { if (!faceAriaDisabled) onClick(); }}
      disabled={disabled || faceDisabled} aria-disabled={faceAriaDisabled || undefined} data-tour-anchor={tourAnchor}
      aria-describedby={faceDescription ? descriptionId : undefined}
    >
      {children ?? (
        <>
          {icon}
          {label && <span className="truncate max-w-[14rem]">{label}</span>}
        </>
      )}
    </Button>
  );
  return (
    <div className="flex">
      {faceTip ? <Tip tip={faceTip} labelsChild={label ? false : undefined}>{face}</Tip> : face}
      {faceDescription && <span id={descriptionId} className="sr-only">{faceDescription}</span>}
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
            {menu.map((action) => (action.checked === undefined ? (
              <Button
                key={action.label}
                variant="ghost"
                className={MENU_ITEM}
                onClick={() => { setOpen(false); action.onClick(); }}
              >
                {action.icon}
                {action.label}
              </Button>
            ) : (
              <label key={action.label} className={cn(buttonVariants({ variant: 'ghost' }), MENU_ITEM, 'cursor-pointer')}>
                <Checkbox className="mr-2" checked={action.checked} onCheckedChange={action.onClick} />
                {action.label}
              </label>
            )))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
