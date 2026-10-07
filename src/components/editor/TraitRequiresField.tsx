import { useId, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  BreadcrumbPicker, BreadcrumbPickerList, type BreadcrumbPickerRow, type BreadcrumbPickerSection,
} from '@/components/ui/breadcrumb-picker';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  WORLD_OWNER, bearerKey, bearerOf, gateOf, gateStates, ownerHolding, requirementOptions, sameRequirement, withBearer,
  type ConditionState, type RequirementBearerOption, type RequirementOption,
} from '@/lib/traitGates';
import { soleBearerRequirement } from '@/lib/requirementBearers';
import { cn } from '@/lib/utils';
import type { Trait, TraitRequirement, TraitRequirementRow } from '@/types';

/** Where the open picker adds: a row's index for **And**, or `new` for a row of its own. */
type AddTarget = number | 'new';

/**
 * The trait panel's Requires field: the trait's Requirement Rows, each a bordered line of chips joined by
 * "and", the rows joined by "or". **And** adds a Condition to its row, **Or Another Way** adds a row, and
 * removing a row's last chip removes the row (Q6). Picking a target opens a second page for the bearer: the
 * same bearer, You, or an entity that bears it. Off-world, or when only one bearer can hold the target, it
 * is added at once. A chip opens its target, unless `opens` says the host has nowhere to open it, when it
 * reads as plain text; a chip whose target is gone reads red under its stored name. `bearerId` names the
 * bearer whose gate the chips read, for a link whose rows differ from its original's; without it, the first
 * bearer holding the trait.
 */
export function TraitRequiresField({ trait, onChange, onOpen, opens = () => true, bearerId, labelAside }: {
  trait: Trait;
  onChange: (requires: TraitRequirementRow[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
  bearerId?: string;
  labelAside?: ReactNode;
}) {
  const { gateInput, placeholders, offWorld } = useTraitStore();
  const [target, setTarget] = useState<AddTarget | null>(null);
  const [picked, setPicked] = useState<RequirementOption | null>(null);
  const labelId = useId();
  const rows = trait.requires ?? [];

  const { states, options, gateOwnerId } = useMemo(() => {
    const gates = gateStates(gateInput);
    const holder = ownerHolding(gateInput.owners, trait.id)?.id ?? WORLD_OWNER;
    const gate = (bearerId !== undefined ? gateOf(gates, bearerId, trait.id) : undefined) ?? gateOf(gates, holder, trait.id);
    return { states: gate?.rows ?? [], options: requirementOptions(gateInput, trait.id), gateOwnerId: bearerId ?? holder };
  }, [gateInput, trait.id, bearerId]);

  // **And** never repeats a Condition in its row; a new row never repeats a one-chip row.
  const taken = target === null ? []
    : target === 'new' ? rows.filter((r) => r.all.length === 1).map((r) => r.all[0])
    : rows[target]?.all ?? [];
  const listed = (requirement: TraitRequirement) => taken.some((r) => sameRequirement(r, requirement));
  const changeTarget = (next: AddTarget | null) => {
    setTarget(next);
    if (next === null) setPicked(null);
  };
  const add = (requirement: TraitRequirement) => {
    onChange(typeof target === 'number'
      ? rows.map((row, i) => (i === target ? { all: [...row.all, requirement] } : row))
      : [...rows, { all: [requirement] }]);
    changeTarget(null);
  };
  const removeCondition = (rowIndex: number, index: number) => onChange(rows.flatMap((row, i) => {
    if (i !== rowIndex) return [row];
    const all = row.all.filter((_, j) => j !== index);
    return all.length ? [{ all }] : [];
  }));
  // What a playing-as row, an off-world row and a target with one possible bearer add at once; any other
  // target asks which bearer first.
  const atOnce = (option: RequirementOption) =>
    (option.requirement.kind === 'playingAs' || offWorld ? option.requirement : soleBearerRequirement(option, gateOwnerId));
  const pick = (option: RequirementOption) => {
    const requirement = atOnce(option);
    if (requirement) add(requirement);
    else setPicked(option);
  };
  /** Every way the row could be added is already listed, so the row has nothing left to add. */
  const exhausted = (option: RequirementOption) => {
    const requirement = atOnce(option);
    // A world trait reads You as its own bearer, so the plain and the You forms are one requirement.
    if (requirement) return [requirement, ...option.bearers.map((b) => withBearer(requirement, b.bearer))].some(listed);
    return listed(option.requirement) && option.bearers.every((b) => listed(withBearer(option.requirement, b.bearer)));
  };

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

  const chip = (requirement: TraitRequirement, state: ConditionState | undefined, remove: () => void) => {
    const text = state?.text ?? '';
    const plain = labelPlaceholders(text, placeholders);
    const unresolved = !!state?.unresolved;
    return (
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
          onClick={remove}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </span>
    );
  };
  const picker = (key: AddTarget, trigger: ReactElement) => (
    <BreadcrumbPicker
      sections={sections}
      onPick={pick}
      open={target === key}
      onOpenChange={(next) => changeTarget(next ? key : null)}
      closeOnPick={false}
      searchPlaceholder={offWorld ? 'Search traits and groups' : 'Search traits, groups, and personas'}
      renderText={renderText}
      plainText={plainText}
      page={(target === key && bearerPage) || undefined}
      trigger={trigger}
    />
  );

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <div className="flex items-center gap-2"><Label id={labelId}>Requires</Label>{labelAside}</div>
      {rows.length > 0 && (
        <div>
          {rows.map((row, i) => {
            const rowText = labelPlaceholders(states[i]?.conditions.map((c) => c.text).join(' and ') ?? '', placeholders);
            return (
              // Rows have no ids; an index key remounts nothing that holds state.
              <div key={i}>
                {i > 0 && <div className="py-1 text-center text-meta text-muted-foreground">or</div>}
                <div data-requirement-row="" className="flex flex-wrap items-center gap-1.5 rounded-md border p-1.5">
                  {row.all.map((requirement, j) => (
                    <span key={`${requirement.kind}:${requirement.id}:${bearerKey(bearerOf(requirement))}:${j}`} className="inline-flex max-w-full items-center gap-1.5">
                      {j > 0 && <span className="text-meta text-muted-foreground">and</span>}
                      {chip(requirement, states[i]?.conditions[j], () => removeCondition(i, j))}
                    </span>
                  ))}
                  {picker(i, (
                    <Button type="button" size="xs" variant="ghost" className="h-7 gap-1">
                      <Plus className="h-3.5 w-3.5" aria-hidden />And
                    </Button>
                  ))}
                  <button
                    type="button"
                    aria-label={`Remove row ${rowText}`}
                    className="ml-auto shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => onChange(rows.filter((_, k) => k !== i))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {picker('new', (
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1">
          <Plus className="h-3.5 w-3.5" aria-hidden />{rows.length ? 'Or Another Way' : 'Add Requirement'}
        </Button>
      ))}
    </div>
  );
}
