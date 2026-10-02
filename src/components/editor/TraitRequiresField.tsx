import { useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import {
  BreadcrumbPicker, BreadcrumbPickerList, type BreadcrumbPickerRow, type BreadcrumbPickerSection,
} from '@/components/ui/breadcrumb-picker';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  WORLD_OWNER, bearerKey, bearerOf, gateOf, gateStates, ownerHolding, requirementOptions, sameRequirement, withBearer,
  type RequirementBearerOption, type RequirementOption,
} from '@/lib/traitGates';
import { cn } from '@/lib/utils';
import type { Trait, TraitRequirement } from '@/types';

/**
 * The trait panel's Requires field: the trait's requirements as chips joined by "or", and a searchable picker
 * that adds one. Picking a target opens a second page for the bearer: the same bearer, You, or an entity that
 * bears it. Off-world the target is added for the same bearer at once. A chip opens its target, unless
 * `opens` says the host has nowhere to open it, when it reads as plain text; a chip whose target is gone
 * reads red under its stored name. `bearerId` names the bearer whose gate the chips read, for a link whose
 * requirements differ from its original's; without it, the first bearer holding the trait.
 */
export function TraitRequiresField({ trait, onChange, onOpen, opens = () => true, bearerId, labelAside }: {
  trait: Trait;
  onChange: (requires: TraitRequirement[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
  bearerId?: string;
  labelAside?: ReactNode;
}) {
  const { gateInput, placeholders, offWorld } = useTraitStore();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<RequirementOption | null>(null);
  const labelId = useId();
  const requires = trait.requires ?? [];

  const { states, options } = useMemo(() => {
    const gates = gateStates(gateInput);
    const holder = ownerHolding(gateInput.owners, trait.id)?.id ?? WORLD_OWNER;
    const gate = (bearerId !== undefined ? gateOf(gates, bearerId, trait.id) : undefined) ?? gateOf(gates, holder, trait.id);
    return { states: gate?.requirements ?? [], options: requirementOptions(gateInput, trait.id) };
  }, [gateInput, trait.id, bearerId]);

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

  const renderText = (text: string) => <PlaceholderText text={text} placeholders={placeholders} />;
  const plainText = (text: string) => labelPlaceholders(text, placeholders);
  const targets = (heading: string, list: RequirementOption[]): BreadcrumbPickerSection<RequirementOption> => ({
    heading,
    rows: list.map((option) => ({
      key: `${option.requirement.kind}:${option.requirement.id}`,
      value: option,
      name: option.label,
      breadcrumb: option.breadcrumb,
      disabled: exhausted(option),
    })),
  });
  const sections = [
    targets('Traits', options.traits),
    targets('Any Trait in a Group', options.groups),
    ...(offWorld ? [] : [targets('Playing As', options.personas)]),
  ];

  const bearerRow = (option: RequirementOption, choice: RequirementBearerOption | null): BreadcrumbPickerRow<TraitRequirement> => {
    const requirement = withBearer(option.requirement, choice?.bearer);
    return {
      key: bearerKey(choice?.bearer),
      value: requirement,
      name: choice?.name ?? 'Same Bearer',
      hint: choice ? undefined : 'Whoever has the trait',
      disabled: listed(requirement),
    };
  };
  // Its own list, so the target search never carries over to the bearer page.
  const bearerPage = picked && (
    <div>
      <div className="flex items-center gap-1 border-b px-2 py-1.5 text-label">
        <Button type="button" variant="ghost" size="xs" className="h-7 w-7 shrink-0 p-0" aria-label="Back to targets" onClick={() => setPicked(null)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <span className="min-w-0 truncate">
          Requires <PlaceholderText text={picked.label} placeholders={placeholders} /> on
        </span>
      </div>
      <BreadcrumbPickerList
        sections={[{ rows: [bearerRow(picked, null), ...picked.bearers.map((choice) => bearerRow(picked, choice))] }]}
        onPick={add}
        searchPlaceholder="Search bearers"
        renderText={renderText}
        plainText={plainText}
      />
    </div>
  );

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <div className="flex items-center gap-2"><Label id={labelId}>Requires</Label>{labelAside}</div>
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
        <BreadcrumbPicker
          sections={sections}
          onPick={pick}
          open={open}
          onOpenChange={changeOpen}
          closeOnPick={false}
          searchPlaceholder={offWorld ? 'Search traits and groups' : 'Search traits, groups, and personas'}
          renderText={renderText}
          plainText={plainText}
          page={bearerPage}
          trigger={(
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1">
              <Plus className="h-3.5 w-3.5" aria-hidden />Add Requirement
            </Button>
          )}
        />
      </div>
    </div>
  );
}
