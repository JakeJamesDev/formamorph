import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OpeningIcon } from '@/lib/elementIcons';
import { pickedOption } from '@/lib/testBench/openingPick';
import type { OpeningPickHandle } from '@/lib/testBench/useOpeningPick';
import { cn } from '@/lib/utils';

// Radix has no value for "nothing selected", so None carries a token of its own.
const NONE = '__none__';

/** The Opening Test Code and the Test Bench run as: None, then every Opening grouped by owner. */
export function OpeningPickSelect({ pick, groups, setPick, label = 'Opening', className }: OpeningPickHandle & { label?: string; className?: string }) {
  const options = groups.flatMap((group) => group.options);
  return (
    <Select
      value={pickedOption(groups, pick)?.id ?? NONE}
      onValueChange={(id) => setPick(options.find((option) => option.id === id)?.key ?? null)}
      disabled={options.length === 0}
    >
      <SelectTrigger size="sm" aria-label={label} className={cn('min-w-0 gap-1', className)}>
        <OpeningIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>None</SelectItem>
        {groups.map((group, at) => (
          <SelectGroup key={`${at}:${group.label}`}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
