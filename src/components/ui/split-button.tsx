import { useState, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** One action in a split button's menu. */
export interface SplitButtonAction {
  label: string;
  onClick: () => void;
}

/**
 * A joined pair: the face runs the action the surface calls for, and the chevron opens the rest.
 *
 * Sized and placed for the editor footer, so the menu opens upward. The face keeps its own icon, since the
 * two footer buttons are told apart by their glyph before their label is read.
 */
export function SplitButton({ icon, label, menu, onClick, disabled, menuLabel }: {
  icon: ReactNode;
  label: string;
  menu: SplitButtonAction[];
  onClick: () => void;
  disabled?: boolean;
  /** The chevron's accessible name, which says what the menu holds. */
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex">
      <Button variant="outline" size="sm" className="rounded-r-none" onClick={onClick} disabled={disabled}>
        {icon}
        <span className="truncate max-w-[14rem]">{label}</span>
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline" size="sm" className="rounded-l-none border-l-0 px-2"
            aria-label={menuLabel} disabled={disabled}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-56 p-1">
          <div className="flex flex-col">
            {menu.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="justify-start text-meta h-8"
                onClick={() => { setOpen(false); action.onClick(); }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
