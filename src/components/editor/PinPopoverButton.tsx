import { Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import type { PinEditorWorld, PinSourceRef } from '@/lib/placeholderPins';
import type { Placeholder, PlaceholderPin } from '@/types';

/**
 * A pin icon with a count badge that opens the shared pin rows in a popover — for a source too small for a
 * section of its own: a descriptor row, a value chip. Modal, so it can wheel-scroll inside a dialog.
 *
 * The trigger is a plain button and the rows hold no chip field, so focus moving here leaves whatever chip
 * field held the palette claim, and `ChipInsertTargetProvider` drops the claim on that focusout. The
 * palette never inserts into a field behind an open pin popover.
 */
export function PinPopoverButton({ pins, onChange, source, world, placeholders, excludeId, label }: {
  pins: PlaceholderPin[];
  onChange: (next: PlaceholderPin[]) => void;
  source: PinSourceRef;
  world: PinEditorWorld | null;
  placeholders: Placeholder[];
  excludeId?: string;
  /** The button's accessible name, naming the row it belongs to. */
  label: string;
}) {
  const count = pins.length;
  return (
    <Popover modal>
      <Tip tip={count ? `${count} placeholder pin${count === 1 ? '' : 's'}` : 'Placeholder pins'}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-7 w-7 shrink-0" aria-label={label}>
            <Pin className="h-4 w-4" />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground"
              >
                {count}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-[28rem] max-w-[calc(100vw-2rem)] space-y-2">
        <Label className="text-meta text-muted-foreground">Placeholder Pins</Label>
        <PlaceholderPinRows
          pins={pins}
          onChange={onChange}
          source={source}
          world={world}
          placeholders={placeholders}
          excludeId={excludeId}
        />
      </PopoverContent>
    </Popover>
  );
}

export default PinPopoverButton;
