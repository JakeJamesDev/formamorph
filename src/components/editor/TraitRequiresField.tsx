import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import { gateStates, requirementOptions, type RequirementOption } from '@/lib/traitGates';
import { cn } from '@/lib/utils';
import type { Trait, TraitRequirement } from '@/types';

const sameRequirement = (a: TraitRequirement, b: TraitRequirement) => a.kind === b.kind && a.id === b.id;

// Substring over the row's shown text; the item value is the requirement key, which no author types.
const filterRows = (_value: string, search: string, keywords: string[] = []) =>
  (keywords.join(' ').toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0);

/**
 * The trait panel's Requires field: the trait's requirements as chips joined by "or", and a searchable picker
 * that adds one. A chip opens its target; a chip whose target is gone reads red under its stored name.
 */
export function TraitRequiresField({ trait, onChange, onOpen }: {
  trait: Trait;
  onChange: (requires: TraitRequirement[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
}) {
  const { gateInput, placeholders, offWorld } = useTraitStore();
  const [open, setOpen] = useState(false);
  const requires = trait.requires ?? [];

  const { states, options } = useMemo(() => ({
    states: gateStates(gateInput).get(trait.id)?.requirements ?? [],
    options: requirementOptions(gateInput, trait.id),
  }), [gateInput, trait.id]);

  const add = (requirement: TraitRequirement) => {
    onChange([...requires, requirement]);
    setOpen(false);
  };

  const row = (option: RequirementOption) => {
    const { kind, id } = option.requirement;
    return (
      <CommandItem
        key={`${kind}:${id}`}
        value={`${kind}:${id}`}
        keywords={[labelPlaceholders(option.label, placeholders), option.where]}
        disabled={requires.some((r) => sameRequirement(r, option.requirement))}
        onSelect={() => add(option.requirement)}
      >
        <span className="min-w-0 flex-1 truncate"><PlaceholderText text={option.label} placeholders={placeholders} /></span>
        <span className="shrink-0 text-meta text-muted-foreground">
          <PlaceholderText text={option.where} placeholders={placeholders} />
        </span>
      </CommandItem>
    );
  };
  const section = (heading: string, list: RequirementOption[]) =>
    list.length > 0 && <CommandGroup heading={heading}>{list.map(row)}</CommandGroup>;

  return (
    <div className="space-y-2">
      <Label>Requires</Label>
      <Hint>Available when any one of these holds</Hint>
      <div className="flex flex-wrap items-center gap-1.5">
        {requires.map((requirement, i) => {
          const state = states[i];
          const text = state?.text ?? '';
          const plain = labelPlaceholders(text, placeholders);
          const unresolved = !!state?.unresolved;
          return (
            <span key={`${requirement.kind}:${requirement.id}:${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-meta text-muted-foreground">or</span>}
              <span
                data-unresolved={unresolved || undefined}
                className={cn(
                  'inline-flex max-w-full items-center gap-0.5 rounded-full border bg-secondary py-0.5 pl-2.5 pr-1 text-label',
                  unresolved && 'border-destructive text-destructive',
                )}
              >
                {unresolved ? (
                  <span className="min-w-0 truncate">{plain}</span>
                ) : (
                  <button
                    type="button"
                    className="min-w-0 truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => onOpen(requirement)}
                  >
                    <PlaceholderText text={text} placeholders={placeholders} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${plain}`}
                  className="shrink-0 rounded-full p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => onChange(requires.filter((_, j) => j !== i))}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            </span>
          );
        })}
        <Popover open={open} onOpenChange={setOpen} modal>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1">
              <Plus className="h-3.5 w-3.5" aria-hidden />Add Requirement
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0"
            align="start"
            collisionBoundary={typeof document === 'undefined' ? undefined : document.documentElement}
          >
            <Command filter={filterRows}>
              <CommandInput placeholder={offWorld ? 'Search traits and groups' : 'Search traits, groups, and personas'} />
              <CommandList>
                <CommandEmpty>No matches</CommandEmpty>
                {section('Traits', options.traits)}
                {section('Any Trait in a Group', options.groups)}
                {!offWorld && section('Playing As', options.personas)}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
