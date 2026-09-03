import { Fragment, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import ChipRowHeading from '@/components/prompt/ChipRowHeading';
import { OwnerIcon } from '@/components/prompt/OwnerHeading';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { chipRowPath, chipSectionOpens, type ChipRow } from '@/lib/chipVocabulary';
import { decodePlaceholderToken } from '@/lib/placeholders';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

/** The placeholder a row names, or `''` for a row whose token names none — which no placeholder vocabulary
 *  produces, and which is the same `''` as picking nothing, so such a row is never marked as the pick. */
const rowId = (row: ChipRow): string => decodePlaceholderToken(row.token)?.id ?? '';

/** True where `id` is the pick. Picking nothing is `''`, which no row may match. */
const isPicked = (id: string, selectedId: string): boolean => id !== '' && id === selectedId;

/**
 * What a closed picker shows for the row it settled on: an owner's placeholder as the whole `Keeper › Mood`
 * behind that owner's icon, and a shared one as its plain name. The path is what keeps a pick clear once the
 * list is gone — under the open list the owner's heading said whose it was, and the heading closes with it.
 */
export const PlaceholderRowPath = ({ row }: { row: ChipRow }) => (
  row.headingKind === 'owner' && row.ownerKind ? (
    <span className="flex min-w-0 items-center gap-1">
      <OwnerIcon kind={row.ownerKind} />
      <span className="truncate">{chipRowPath(row)}</span>
    </span>
  ) : <span className="truncate">{row.label}</span>
);

/**
 * The picker every placeholder-choosing dropdown is: a popover over the vocabulary's own sectioned rows,
 * folders headed as quiet text and owners as their heading with an icon, so the Pins dropdown and the find
 * bar read the same list the palette bar and the `{` menu do. Rows under an owner read bare — the heading
 * already says whose they are.
 *
 * Not a Radix Select: a Select renders its listbox in a portal of its own, which the editor dialog's scroll
 * lock puts out of the wheel's reach, and it takes plain strings where a heading needs an owner's name with
 * its chips drawn. `portal={false}` keeps the list inside the dialog's own subtree, where the wheel reaches
 * it and a native `max-h` is all the scrolling it needs.
 */
export function PlaceholderSectionList({ rows, selectedId, onSelect, placeholders, empty = 'Select placeholder', footer, trigger, className }: {
  rows: readonly ChipRow[];
  /** The placeholder the picker stands on, or `''` while it stands on none. */
  selectedId: string;
  onSelect: (id: string) => void;
  /** Everything a chip in an owner's name could point at. Defaults to the bound store's list. */
  placeholders?: readonly Placeholder[];
  /** What the trigger reads while nothing is picked. */
  empty?: string;
  /** Drawn under the rows, inside the popover — the find bar's Create row. Given the close, so a footer that
   *  settles the pick can shut the list behind it. */
  footer?: (close: () => void) => ReactNode;
  /** The trigger this picker hangs off, wrapped around what the pick reads as. Absent, a full-width button. */
  trigger?: (content: ReactNode) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = rows.find((row) => isPicked(rowId(row), selectedId));
  const content = selected
    ? <PlaceholderRowPath row={selected} />
    : <span className="truncate text-muted-foreground">{empty}</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ? trigger(content) : (
          // A plain button, not `role="combobox"`: a combobox takes its accessible name from a label rather
          // than from its contents, and what this trigger is named is exactly what it reads.
          <Button
            type="button"
            variant="outline"
            className={cn('w-full justify-between gap-1 font-normal', className)}
          >
            {content}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent portal={false} align="start" className="w-64 p-1">
        <div className="max-h-56 overflow-y-auto">
          {/* A heading is drawn off the first row under it, so a section nothing offers shows none. */}
          {rows.map((row, i) => (
            <Fragment key={row.token}>
              {chipSectionOpens(rows, i) && row.heading && (
                <div className="px-2 pb-0.5 pt-1.5"><ChipRowHeading row={row} placeholders={placeholders} /></div>
              )}
              <button
                type="button"
                data-testid="placeholder-section-row"
                onClick={() => { onSelect(rowId(row)); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-label hover:bg-accent"
              >
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                {isPicked(rowId(row), selectedId) && <Check className="h-4 w-4 shrink-0" aria-hidden />}
              </button>
            </Fragment>
          ))}
          {!rows.length && <p className="px-2 py-1.5 text-helper text-muted-foreground">No placeholders.</p>}
        </div>
        {footer?.(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

export default PlaceholderSectionList;
