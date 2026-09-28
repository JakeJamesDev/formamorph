import { useMemo, useState } from 'react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  WORLD_OWNER, bearerKey, bearerOf, gateOf, gateStates, ownerHolding, requirementOptions, sameRequirement, withBearer,
  type RequirementBearerOption, type RequirementOption,
} from '@/lib/traitGates';
import { cn } from '@/lib/utils';
import type { Trait, TraitRequirement } from '@/types';

// Substring over the row's shown text; the item value is the requirement key, which no author types.
const filterRows = (_value: string, search: string, keywords: string[] = []) =>
  (keywords.join(' ').toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0);

/**
 * The trait panel's Requires field: the trait's requirements as chips joined by "or", and a searchable picker
 * that adds one. Picking a target opens a second page for the bearer: the same bearer, You, or an entity that
 * bears it. Off-world the target is added for the same bearer at once. A chip opens its target, unless
 * `opens` says the host has nowhere to open it, when it reads as plain text; a chip whose target is gone
 * reads red under its stored name.
 */
export function TraitRequiresField({ trait, onChange, onOpen, opens = () => true }: {
  trait: Trait;
  onChange: (requires: TraitRequirement[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
}) {
  const { gateInput, placeholders, offWorld } = useTraitStore();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<RequirementOption | null>(null);
  const requires = trait.requires ?? [];

  const { states, options } = useMemo(() => ({
    states: gateOf(gateStates(gateInput), ownerHolding(gateInput.owners, trait.id)?.id ?? WORLD_OWNER, trait.id)?.requirements ?? [],
    options: requirementOptions(gateInput, trait.id),
  }), [gateInput, trait.id]);

  const listed = (requirement: TraitRequirement) => requires.some((r) => sameRequirement(r, requirement));
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setPicked(null);
  };
  const add = (requirement: TraitRequirement) => {
    onChange([...requires, requirement]);
    changeOpen(false);
  };
  // A playing-as row and an off-world row add at once; any other target asks which bearer first.
  const pick = (option: RequirementOption) => {
    if (option.requirement.kind === 'playingAs' || offWorld) add(option.requirement);
    else setPicked(option);
  };
  /** Every way the row could be added is already listed, so the row has nothing left to add. */
  const exhausted = (option: RequirementOption) =>
    listed(option.requirement) && option.bearers.every((b) => listed(withBearer(option.requirement, b.bearer)));

  const targetRow = (option: RequirementOption) => {
    const { kind, id } = option.requirement;
    return (
      <CommandItem
        key={`${kind}:${id}`}
        value={`${kind}:${id}`}
        keywords={[labelPlaceholders(option.label, placeholders), option.where]}
        disabled={exhausted(option)}
        onSelect={() => pick(option)}
      >
        <span className="min-w-0 flex-1 truncate"><PlaceholderText text={option.label} placeholders={placeholders} /></span>
        <span className="shrink-0 text-meta text-muted-foreground">
          <PlaceholderText text={option.where} placeholders={placeholders} />
        </span>
      </CommandItem>
    );
  };
  const section = (heading: string, list: RequirementOption[]) =>
    list.length > 0 && <CommandGroup heading={heading}>{list.map(targetRow)}</CommandGroup>;

  const bearerRow = (option: RequirementOption, choice: RequirementBearerOption | null) => {
    const requirement = withBearer(option.requirement, choice?.bearer);
    const name = choice?.name ?? 'Same Bearer';
    return (
      <CommandItem
        key={bearerKey(choice?.bearer)}
        value={bearerKey(choice?.bearer)}
        keywords={[labelPlaceholders(name, placeholders)]}
        disabled={listed(requirement)}
        onSelect={() => add(requirement)}
      >
        <span className="min-w-0 flex-1 truncate"><PlaceholderText text={name} placeholders={placeholders} /></span>
        {!choice && <span className="shrink-0 text-meta text-muted-foreground">Whoever has the trait</span>}
      </CommandItem>
    );
  };

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
            <span key={`${requirement.kind}:${requirement.id}:${bearerKey(bearerOf(requirement))}:${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-meta text-muted-foreground">or</span>}
              <span
                data-unresolved={unresolved || undefined}
                className={cn(
                  'inline-flex max-w-full items-center gap-0.5 rounded-full border bg-secondary py-0.5 pl-2.5 pr-1 text-label',
                  unresolved && 'border-destructive text-destructive',
                )}
              >
                {unresolved || !opens(requirement) ? (
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
        <Popover open={open} onOpenChange={changeOpen} modal>
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
            {picked ? (
              // Its own Command, so the target search never carries over to the bearer page.
              <Command key="bearer" filter={filterRows}>
                <div className="flex items-center gap-1 border-b px-2 py-1.5 text-label">
                  <Button type="button" variant="ghost" size="xs" className="h-7 w-7 shrink-0 p-0" aria-label="Back to targets" onClick={() => setPicked(null)}>
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Button>
                  <span className="min-w-0 truncate">
                    Requires <PlaceholderText text={picked.label} placeholders={placeholders} /> on
                  </span>
                </div>
                <CommandInput placeholder="Search bearers" />
                <CommandList>
                  <CommandEmpty>No matches</CommandEmpty>
                  <CommandGroup>
                    {bearerRow(picked, null)}
                    {picked.bearers.map((choice) => bearerRow(picked, choice))}
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : (
              <Command key="target" filter={filterRows}>
                <CommandInput placeholder={offWorld ? 'Search traits and groups' : 'Search traits, groups, and personas'} />
                <CommandList>
                  <CommandEmpty>No matches</CommandEmpty>
                  {section('Traits', options.traits)}
                  {section('Any Trait in a Group', options.groups)}
                  {!offWorld && section('Playing As', options.personas)}
                </CommandList>
              </Command>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
