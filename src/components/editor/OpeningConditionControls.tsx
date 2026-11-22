import { forwardRef, useState, type ComponentProps } from 'react';
import { CheckIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { openingKeyId, openingLabelMap, openingNames } from '@/lib/openingCondition';
import { notFlag } from '@/lib/requirementRows';
import type { OpeningPickGroup, OpeningPickOption } from '@/lib/testBench/openingPick';
import { cn } from '@/lib/utils';
import type { OpeningRequirement } from '@/types';

/** Up to this many Openings, or with one owner, the list is flat; past it, it opens on the owners. */
export const FLAT_OPENING_LIMIT = 8;

const Check = ({ selected }: { selected: boolean }) => (
  <span
    aria-hidden
    className={cn('mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary', selected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible')}
  >
    <CheckIcon className="h-4 w-4" />
  </span>
);

const OpeningTrigger = forwardRef<HTMLButtonElement, { text: string } & ComponentProps<'button'>>(({ text, ...props }, ref) => (
  <button
    ref={ref}
    {...props}
    type="button"
    aria-label={`Openings: ${text}`}
    className="inline-flex min-w-0 items-center gap-1 rounded-sm px-1 text-label hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
  >
    <span className="min-w-0 truncate">Opening {text}</span>
    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
  </button>
));
OpeningTrigger.displayName = 'OpeningTrigger';

/**
 * The Opening pick-many an Opening Condition chip carries. A few Openings, or one owner's, list flat under owner
 * headings; more open on the owners, each a page of its Openings. Select All tops every list and toggles what it
 * covers. An emptied Condition stays, unresolved, until an Opening is checked again. A toggle keeps only listed keys, so a deleted Opening's key drops on
 * the next edit (Q19). `accepts` says whether a replacement would repeat another Condition in the row.
 */
export function OpeningConditionControls({ requirement, groups, accepts, onChange }: {
  requirement: OpeningRequirement;
  groups: readonly OpeningPickGroup[];
  accepts: (next: OpeningRequirement) => boolean;
  onChange: (next: OpeningRequirement) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<number | null>(null);
  const all = groups.flatMap((g) => g.options);
  const on = new Set(requirement.openings.map(openingKeyId));
  const live = all.filter((o) => on.has(o.id));
  const flat = groups.length <= 1 || all.length <= FLAT_OPENING_LIMIT;
  const withIds = (ids: ReadonlySet<string>): OpeningRequirement =>
    ({ kind: 'opening', openings: all.filter((o) => ids.has(o.id)).map((o) => o.key), ...notFlag(requirement.not) });
  const toggled = (id: string) => {
    const ids = new Set(live.map((o) => o.id));
    if (ids.has(id)) ids.delete(id); else ids.add(id);
    return withIds(ids);
  };
  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setPage(null);
  };

  const optionRow = (option: OpeningPickOption) => {
    const selected = on.has(option.id);
    const next = toggled(option.id);
    return (
      <CommandItem
        key={option.id} value={option.id} aria-checked={selected}
        disabled={!accepts(next)}
        onSelect={() => onChange(next)} className="cursor-pointer"
      >
        <Check selected={selected} />
        {option.label}
      </CommandItem>
    );
  };
  // Select All adds `options` to the pick, and once they are all on it takes them off again.
  const selectAll = (options: readonly OpeningPickOption[]) => {
    const done = options.every((o) => on.has(o.id));
    const covered = new Set(options.map((o) => o.id));
    const next = withIds(new Set(done ? live.filter((o) => !covered.has(o.id)).map((o) => o.id) : [...live, ...options].map((o) => o.id)));
    return (
      <CommandGroup>
        <CommandItem value="select-all" aria-checked={done} disabled={!accepts(next)} onSelect={() => onChange(next)} className="cursor-pointer">
          <Check selected={done} />
          Select All
        </CommandItem>
      </CommandGroup>
    );
  };
  const shown = page === null ? null : groups[page];

  return (
    <Popover open={open} onOpenChange={close} modal>
      <PopoverTrigger asChild><OpeningTrigger text={openingNames(requirement, openingLabelMap(groups))} /></PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-56 max-w-80 p-0">
        <Command label="Openings" key={page ?? 'all'}>
          {shown && (
            <button
              type="button"
              className="flex w-full items-center gap-1 border-b px-2 py-1.5 text-label text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onClick={() => setPage(null)}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> <span className="truncate">{shown.label}</span>
            </button>
          )}
          <CommandList aria-multiselectable="true">
            {shown ? (
              <>
                {selectAll(shown.options)}
                <CommandGroup>{shown.options.map(optionRow)}</CommandGroup>
              </>
            ) : flat ? (
              <>
                {selectAll(all)}
                {groups.map((group, at) => (
                  <CommandGroup key={`${at}:${group.label}`} heading={group.label}>{group.options.map(optionRow)}</CommandGroup>
                ))}
              </>
            ) : (
              <>
                {selectAll(all)}
                <CommandGroup>
                  {groups.map((group, at) => {
                    const picked = group.options.filter((o) => on.has(o.id)).length;
                    return (
                      <CommandItem key={`${at}:${group.label}`} value={`owner:${at}`} onSelect={() => setPage(at)} className="cursor-pointer justify-between">
                        <span className="truncate">{group.label}</span>
                        <span className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
                          {picked ? `${picked} of ${group.options.length}` : group.options.length}
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
