import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import {
  BreadcrumbPicker, BreadcrumbPickerHeader, BreadcrumbPickerList, type BreadcrumbPickerNode, type BreadcrumbPickerRow, type BreadcrumbPickerSection,
} from '@/components/ui/breadcrumb-picker';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { StatConditionControls } from '@/components/editor/StatConditionControls';
import { TimeConditionControls } from '@/components/editor/TimeConditionControls';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  requirementOwnerKey, requirementOwnerOf, flipped, sameRequirement, statTail, withRequirementOwner,
  type ConditionState, type RequirementOwnerOption, type RequirementOption, type RequirementOptions, type RowState,
} from '@/lib/traitGates';
import { soleOwnerRequirement } from '@/lib/requirementOwners';
import { joinAnd } from '@/lib/requirementSummary';
import type { RequirementStatSection } from '@/lib/requirementStatOptions';
import { cn } from '@/lib/utils';
import type { Placeholder, TraitRequirement, TraitRequirementRow } from '@/types';

/** The picker's one time row: a time Condition starts on night alone. */
const TIME_OPTION: RequirementOption = { requirement: { kind: 'time', dayparts: ['night'] }, label: 'Time of Day', breadcrumb: [], owners: [] };

/** Where the open picker adds: a row's index for **And**, or `new` for a row of its own. */
type AddTarget = number | 'new';

/**
 * The Requires field over plain data: Requirement Rows, each a bordered line of chips joined by "and", the
 * rows joined by "or". **And** adds a Condition to its row, **Or Another Way** adds a row, and removing a
 * row's last chip removes the row (Q6). Picking a target opens a second page for the owner: the same
 * owner, Persona, or an entity that owns it. Off-world, or for a global target, it is added at once. A chip
 * opens its target, unless `opens` says the host has nowhere to open it, when it
 * reads as plain text; a chip whose target is gone reads red under its stored name. Each chip flips between
 * plain and Not; a Not chip shows a NOT mark and a dashed border.
 *
 * A stat Condition has its own chip: the stat's name, then a segmented operator, the number and a Raw / %
 * toggle, all editable in place. It reads as plain text, since a stat has nowhere to open, and an edit that
 * would repeat another Condition in the row is held back. The same stat can sit in a row twice, once as a
 * floor and once as a ceiling.
 *
 * A time Condition's chip is a toggle per daypart, at least one on, with no Not. A row holds one at most.
 *
 * The host supplies everything the rows read: `states` the rows' evaluated state in the same order, `options`
 * the targets an author can add, `statSections` the stats by owner, and `textOf` the rule text of one Condition.
 */
export function RequirementRowsField({
  rows, states, options, statSections = [], textOf, placeholders, offWorld = false, onChange, onOpen, opens = () => true, label = 'Requires', labelAside, hostName,
}: {
  rows: TraitRequirementRow[];
  states: readonly RowState[];
  options: RequirementOptions;
  statSections?: readonly RequirementStatSection[];
  textOf: (requirement: TraitRequirement) => string;
  placeholders: readonly Placeholder[];
  offWorld?: boolean;
  onChange: (rows: TraitRequirementRow[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
  /** The field's name, for a host whose rows are not a trait's requirement. */
  label?: string;
  labelAside?: ReactNode;
  /** Who a Condition with no owner reads, as the owner page names it. Absent, the same owner as the host. */
  hostName?: string;
}) {
  const [target, setTarget] = useState<AddTarget | null>(null);
  const [picked, setPicked] = useState<RequirementOption | null>(null);
  const labelId = useId();

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
  // A replacement never repeats another Condition in its row, nor turns a one-chip row into a copy of another.
  const canReplace = (rowIndex: number, index: number, next: TraitRequirement) => {
    const row = rows[rowIndex];
    if (row.all.some((other, j) => j !== index && sameRequirement(other, next))) return false;
    return row.all.length > 1 || !rows.some((r, k) => k !== rowIndex && r.all.length === 1 && sameRequirement(r.all[0], next));
  };
  const replaceCondition = (rowIndex: number, index: number, next: TraitRequirement) => onChange(rows.map((row, i) =>
    (i === rowIndex ? { all: row.all.map((req, j) => (j === index ? next : req)) } : row)));
  // A stat row names its owner in the section it sits in, so it needs no owner page. What a playing-as row,
  // an off-world row and a global target add at once; any other target asks which owner first.
  const atOnce = (option: RequirementOption) =>
    (option.requirement.kind === 'playingAs' || option.requirement.kind === 'stat' || option.requirement.kind === 'time' || offWorld
      ? option.requirement : soleOwnerRequirement(option));
  const pick = (option: RequirementOption) => {
    const requirement = atOnce(option);
    if (requirement) add(requirement);
    else setPicked(option);
  };
  /** Every way the row could be added is already listed, so the row has nothing left to add. */
  const exhausted = (option: RequirementOption) => {
    // One time Condition per row: its chip edits the dayparts.
    if (option.requirement.kind === 'time') return taken.some((r) => r.kind === 'time');
    const requirement = atOnce(option);
    if (requirement) return [requirement, ...option.owners.map((o) => withRequirementOwner(requirement, o.owner))].some(listed);
    return listed(option.requirement) && option.owners.every((o) => listed(withRequirementOwner(option.requirement, o.owner)));
  };

  const renderText = (text: string) => <PlaceholderText text={text} placeholders={placeholders} />;
  const plainText = (text: string) => labelPlaceholders(text, placeholders);
  const targets = (heading: string, list: RequirementOption[]): BreadcrumbPickerSection<RequirementOption> => ({
    heading,
    rows: list.map((option) => ({
      // One stat can sit under several owners.
      key: `${option.requirement.kind}:${option.requirement.id}${option.requirement.kind === 'stat' ? `:${requirementOwnerKey(requirementOwnerOf(option.requirement))}` : ''}`,
      value: option,
      name: option.label,
      breadcrumb: option.breadcrumb,
      disabled: exhausted(option),
    })),
  });
  // Off-world only the entity's own stats exist to read.
  const shownStats = statSections.filter((s) => !offWorld || s.own);
  const searchable = joinAnd(['traits', 'groups', ...(shownStats.length ? ['stats'] : []), 'time of day', ...(offWorld ? [] : ['personas'])]);
  // One owner page per home, the world first and then in tree order; pages key on the owner's id, not its name.
  const ownerPages = (prefix: string, list: RequirementOption[]): BreadcrumbPickerNode<RequirementOption>[] => {
    const homes = new Map<string, { heading: string; list: RequirementOption[] }>();
    for (const option of list) {
      const id = option.home?.id ?? '';
      const home = homes.get(id) ?? { heading: option.home?.name ?? 'World', list: [] };
      home.list.push(option);
      homes.set(id, home);
    }
    return [...homes].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([id, home]): BreadcrumbPickerNode<RequirementOption> => ({
      kind: 'page', key: `${prefix}:${id}`, heading: home.heading, children: [{ kind: 'section', rows: targets('', home.list).rows }],
    }));
  };
  const category = (key: string, heading: string, children: BreadcrumbPickerNode<RequirementOption>[]): BreadcrumbPickerNode<RequirementOption>[] =>
    (children.length ? [{ kind: 'page', key, heading, children }] : []);
  const tree: BreadcrumbPickerNode<RequirementOption>[] = [
    ...category('traits', 'Traits', ownerPages('traits', options.traits)),
    ...category('groups', 'Any Trait in a Group', ownerPages('groups', options.groups)),
    ...category('stats', 'Stats', shownStats.map((s, i): BreadcrumbPickerNode<RequirementOption> => ({
      kind: 'page', key: `stats:${i}`, heading: s.owner, children: [{ kind: 'section', ...targets(s.heading, s.options) }],
    }))),
    ...category('time', 'Time of Day', [{ kind: 'section', ...targets('Time of Day', [TIME_OPTION]) }]),
    ...(offWorld ? [] : category('playingAs', 'Playing As', [{ kind: 'section', ...targets('Playing As', options.personas) }])),
  ];

  const ownerRow = (option: RequirementOption, choice: RequirementOwnerOption | null): BreadcrumbPickerRow<TraitRequirement> => {
    const requirement = withRequirementOwner(option.requirement, choice?.owner);
    return {
      key: requirementOwnerKey(choice?.owner),
      value: requirement,
      name: choice?.name ?? hostName ?? 'Same Owner',
      hint: choice || hostName ? undefined : 'Whoever has the trait',
      disabled: listed(requirement),
    };
  };
  // Its own list, so the target search never carries over to the owner page.
  const ownerPage = picked && (
    <div>
      <BreadcrumbPickerHeader backLabel="Back to targets" onBack={() => setPicked(null)}>
        Requires <PlaceholderText text={picked.label} placeholders={placeholders} /> on
      </BreadcrumbPickerHeader>
      <BreadcrumbPickerList
        sections={[{ rows: [ownerRow(picked, null), ...picked.owners.map((choice) => ownerRow(picked, choice))] }]}
        onPick={add}
        searchPlaceholder="Search owners"
        renderText={renderText}
        plainText={plainText}
      />
    </div>
  );

  const chip = (
    requirement: TraitRequirement,
    state: ConditionState | undefined,
    edit: { remove: () => void; replace: (next: TraitRequirement) => void; accepts: (next: TraitRequirement) => boolean },
  ) => {
    // The rule reads "not Paladin"; a Not chip shows its target, "Paladin", behind the NOT mark.
    const ruleLabel = labelPlaceholders(state?.text ?? '', placeholders);
    const targetText = requirement.not ? textOf(flipped(requirement)) : state?.text ?? '';
    const targetLabel = labelPlaceholders(targetText, placeholders);
    const unresolved = !!state?.unresolved;
    const mark = requirement.not && <><span className="text-meta font-semibold tracking-wide">NOT</span>{' '}</>;
    // A stat chip shows the stat's name, with the comparison in its controls rather than in the text.
    const stat = requirement.kind === 'stat' ? requirement : null;
    const tail = stat ? ` ${statTail(stat)}` : '';
    const statName = targetText.endsWith(tail) ? targetText.slice(0, targetText.length - tail.length) : targetText;
    // A time chip is its daypart toggles; the complement is the other dayparts, so it has no Not.
    const time = requirement.kind === 'time' ? requirement : null;
    return (
      <span
        role={stat || time ? 'group' : undefined}
        aria-label={stat || time ? ruleLabel : undefined}
        data-unresolved={unresolved || undefined}
        data-not={requirement.not || undefined}
        className={cn(
          'inline-flex max-w-full items-center gap-0.5 rounded-full border bg-secondary py-0.5 pl-2.5 pr-1 text-label',
          (stat || time) && 'flex-wrap gap-y-1',
          time && 'flex-nowrap rounded-2xl',
          requirement.not && 'border-dashed',
          unresolved && 'border-destructive text-destructive',
        )}
      >
        {time ? (
          <TimeConditionControls requirement={time} accepts={edit.accepts} onChange={edit.replace} />
        ) : stat ? (
          <>
            <span className="min-w-0 truncate">{mark}<PlaceholderText text={statName} placeholders={placeholders} /></span>
            <span className="ml-1.5 inline-flex items-center gap-1.5 text-foreground">
              <StatConditionControls
                requirement={stat}
                accepts={edit.accepts}
                onChange={edit.replace}
              />
            </span>
          </>
        ) : unresolved || !opens(requirement) ? (
          <span className="min-w-0 truncate">{mark}{targetLabel}</span>
        ) : (
          <button
            type="button"
            className="min-w-0 truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={() => onOpen(requirement)}
          >
            {mark}<PlaceholderText text={targetText} placeholders={placeholders} />
          </button>
        )}
        {!time && <Tip tip={requirement.not ? 'Require it instead' : 'Require it to be off'}>
          <button
            type="button"
            aria-label={requirement.not ? `Require ${targetLabel} instead` : `Require ${targetLabel} to be off`}
            aria-pressed={!!requirement.not}
            disabled={!edit.accepts(flipped(requirement))}
            className="shrink-0 rounded-full p-0.5 hover:bg-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={() => edit.replace(flipped(requirement))}
          >
            <ArrowLeftRight className="h-3 w-3" aria-hidden />
          </button>
        </Tip>}
        <button
          type="button"
          aria-label={`Remove ${ruleLabel}`}
          className="shrink-0 rounded-full p-0.5 hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={edit.remove}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </span>
    );
  };
  const picker = (key: AddTarget, trigger: ReactElement) => (
    <BreadcrumbPicker
      tree={tree}
      onPick={pick}
      open={target === key}
      onOpenChange={(next) => changeTarget(next ? key : null)}
      closeOnPick={false}
      searchPlaceholder={`Search ${searchable}`}
      renderText={renderText}
      plainText={plainText}
      page={(target === key && ownerPage) || undefined}
      trigger={trigger}
    />
  );

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <div className="flex items-center gap-2"><Label id={labelId}>{label}</Label>{labelAside}</div>
      {rows.length > 0 && (
        <div>
          {rows.map((row, i) => {
            const rowText = labelPlaceholders(states[i]?.conditions.map((c) => c.text).join(' and ') ?? '', placeholders);
            return (
              // Rows have no ids; an index key remounts nothing that holds state.
              <div key={i}>
                {i > 0 && <div className="py-1 text-center text-meta text-muted-foreground">or</div>}
                <div data-requirement-row="" className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background p-1.5">
                  {row.all.map((requirement, j) => (
                    <span key={`${requirement.kind}:${requirement.id}:${requirementOwnerKey(requirementOwnerOf(requirement))}:${j}`} className="inline-flex max-w-full items-center gap-1.5">
                      {j > 0 && <span className="text-meta text-muted-foreground">and</span>}
                      {chip(requirement, states[i]?.conditions[j], {
                        remove: () => removeCondition(i, j),
                        replace: (next) => replaceCondition(i, j, next),
                        accepts: (next) => canReplace(i, j, next),
                      })}
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
                    className="ml-auto shrink-0 rounded-sm p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
