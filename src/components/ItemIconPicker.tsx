import { useState, type ReactNode } from 'react';
import { Ban, ChevronDown } from 'lucide-react';
import { ItemIconArt } from '@/components/ItemIconArt';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchField } from '@/components/ui/search-field';
import { selectTriggerVariants } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { ITEM_ICON_NONE, itemIconById, itemIconName, searchItemIcons, type ItemIconEntry } from '@/lib/itemIcons';
import { cn } from '@/lib/utils';

/** The catalog's last group holds only the generic icon, so its heading reads as the author's word. */
const groupHeading = (group: string) => (group === 'Fallback' ? 'Other' : group);

function groupsOf(icons: readonly ItemIconEntry[]) {
  const groups = new Map<string, ItemIconEntry[]>();
  for (const icon of icons) groups.set(icon.group, [...(groups.get(icon.group) ?? []), icon]);
  return [...groups];
}

function ChoiceTile({ picked, tip, label, glyph, onPick }: { picked: boolean; tip: string; label: string; glyph: ReactNode; onPick: () => void }) {
  return (
    <Tip tip={tip} labelsChild={false}>
      <Button type="button" variant={picked ? 'default' : 'outline'} aria-pressed={picked} className="h-10 gap-2" onClick={onPick}>
        {glyph}
        {label}
      </Button>
    </Tip>
  );
}

/** The open picker. It mounts per opening, so each opening starts with an empty search. */
function ItemIconGrid({ choice, derivedId, onPick }: { choice: string | undefined; derivedId: string; onPick: (icon: string | undefined) => void }) {
  const [search, setSearch] = useState('');
  const groups = groupsOf(searchItemIcons(search));
  return (
    <div className="space-y-2 p-2">
      <SearchField size="sm" value={search} onChange={setSearch} placeholder="Search Icons" aria-label="Search Icons" />
      <div className="grid grid-cols-2 gap-1">
        <ChoiceTile
          picked={choice === undefined}
          tip="Picks an icon from the item's name, then its slots"
          label="Auto"
          glyph={<ItemIconArt id={derivedId} className="h-5 w-5" />}
          onPick={() => onPick(undefined)}
        />
        <ChoiceTile
          picked={choice === ITEM_ICON_NONE}
          tip="Shows the item's image"
          label="None"
          glyph={<Ban className="h-4 w-4" aria-hidden />}
          onPick={() => onPick(ITEM_ICON_NONE)}
        />
      </div>
      <ScrollArea className="max-h-72">
        {groups.length === 0 && <Hint role="status" className="py-6 text-center">No matches</Hint>}
        <div className="space-y-2 pr-3">
          {groups.map(([group, icons]) => (
            <section key={group} aria-label={groupHeading(group)} className="space-y-1">
              <h3 className="text-meta font-medium text-muted-foreground">{groupHeading(group)}</h3>
              <div className="grid grid-cols-6 gap-1">
                {icons.map((icon) => (
                  <Tip key={icon.id} tip={itemIconName(icon)}>
                    <Button
                      type="button"
                      variant={choice === icon.id ? 'default' : 'ghost'}
                      size="icon"
                      aria-label={itemIconName(icon)}
                      aria-pressed={choice === icon.id}
                      className={cn('h-10 w-full', choice !== icon.id && 'border-transparent')}
                      onClick={() => onPick(icon.id)}
                    >
                      <ItemIconArt id={icon.id} className="h-6 w-6" />
                    </Button>
                  </Tip>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * A form control that picks an item's icon from a searchable grid of the catalog. `value` is `Item.icon`;
 * `derivedId` is the icon Auto shows now. `onPick` gets an icon id, `'none'`, or `undefined` for Auto.
 */
export function ItemIconPicker({ value, derivedId, onPick, labelId, describedBy, className }: {
  value: string | undefined;
  derivedId: string;
  onPick: (icon: string | undefined) => void;
  labelId?: string;
  describedBy?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const specific = value ? itemIconById(value) : undefined;
  const choice = value === ITEM_ICON_NONE ? ITEM_ICON_NONE : specific?.id;
  const shownName = choice === ITEM_ICON_NONE ? 'None' : specific ? itemIconName(specific) : 'Auto';
  const pick = (icon: string | undefined) => {
    onPick(icon);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          className={cn(selectTriggerVariants(), className)}
        >
          <span className="!flex min-w-0 items-center gap-2">
            {choice === ITEM_ICON_NONE
              ? <Ban className="h-4 w-4 shrink-0" aria-hidden />
              : <ItemIconArt id={specific?.id ?? derivedId} className="h-5 w-5 shrink-0" />}
            <span className="truncate">{shownName}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        collisionBoundary={typeof document === 'undefined' ? undefined : document.documentElement}
      >
        <ItemIconGrid choice={choice} derivedId={derivedId} onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}
