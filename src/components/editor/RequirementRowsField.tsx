import { Fragment, useId, useState, type ReactElement, type ReactNode } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import {
  BreadcrumbPicker, type BreadcrumbPickerNode, type BreadcrumbPickerSection,
} from '@/components/ui/breadcrumb-picker';
import { MUTED_SENTENCE_TOKEN_CLASS } from '@/components/ui/sentence-token';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { RequirementClause, type ClauseContext } from '@/components/editor/RequirementClause';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  clauseText, requirementOwnerKey, requirementOwnerOf, sameRequirement,
  type ClauseHost, type ClausePart, type ClauseView, type RequirementOption, type RequirementOptions,
} from '@/lib/traitGates';
import { joinAnd } from '@/lib/requirementSummary';
import type { RequirementStatSection } from '@/lib/requirementStatOptions';
import type { Placeholder, TraitRequirement, TraitRequirementRow } from '@/types';
import { Hint } from '@/components/ui/typography';

/** The picker's one time row: a time Condition starts with no daypart, unresolved until one is on. */
const TIME_OPTION: RequirementOption = { requirement: { kind: 'time', dayparts: [] }, label: 'Time of Day', breadcrumb: [], owners: [] };

/** Where the open picker adds: a row's index for **And**, or `new` for a row of its own. */
type AddTarget = number | 'new';

/**
 * The Requires field over plain data: each Requirement Row is one sentence of Conditions joined by "and", the
 * rows joined by "or" lines. Each Condition is one box of tokens with its × and its "and", so a box that does
 * not fit moves to the next line whole (Q22). "and…" adds a Condition to its row, "or…" adds a row, and
 * removing a row's last Condition removes the row. A new Condition starts with no owner (Q7).
 *
 * An edit never repeats another Condition in its row, nor turns a one-Condition row into a copy of another; a
 * list row or a flip that would is disabled. The same stat can sit in a row twice, once as a floor and once as
 * a ceiling. A row holds one time, one weather and one Opening Condition at most.
 *
 * The host supplies what the rows read: `options` the targets an author can add, `statSections` the stats by
 * owner, `clausesOf` a Condition's clause parts and `clauseHost` the record a Condition with no owner reads.
 */
export function RequirementRowsField({
  rows, options, statSections = [], clausesOf, clauseHost, placeholders, offWorld = false, onChange, onOpen, opens = () => true, label = 'Requires', labelAside, hint,
}: {
  rows: TraitRequirementRow[];
  options: RequirementOptions;
  statSections?: readonly RequirementStatSection[];
  clausesOf: (requirement: TraitRequirement, view?: ClauseView) => ClausePart[];
  clauseHost: ClauseHost;
  placeholders: readonly Placeholder[];
  offWorld?: boolean;
  onChange: (rows: TraitRequirementRow[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
  /** The field's name, for a host whose rows are not a trait's requirement. */
  label?: string;
  labelAside?: ReactNode;
  /** Help line between the label and the rows. */
  hint?: ReactNode;
}) {
  const [target, setTarget] = useState<AddTarget | null>(null);
  const labelId = useId();

  // **And** never repeats a Condition in its row; a new row never repeats a one-chip row.
  const taken = target === null ? []
    : target === 'new' ? rows.filter((r) => r.all.length === 1).map((r) => r.all[0])
    : rows[target]?.all ?? [];
  const listed = (requirement: TraitRequirement) => taken.some((r) => sameRequirement(r, requirement));
  const add = (requirement: TraitRequirement) => {
    onChange(typeof target === 'number'
      ? rows.map((row, i) => (i === target ? { all: [...row.all, requirement] } : row))
      : [...rows, { all: [requirement] }]);
    setTarget(null);
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
  // Every kind adds at once with no owner, a stat with the owner of its section.
  const pick = (option: RequirementOption) => add(option.requirement);
  /** Every way the row could be added is already listed, so the row has nothing left to add. */
  const exhausted = (option: RequirementOption) => {
    // One time Condition per row: its chip edits the dayparts.
    if (option.requirement.kind === 'time') return taken.some((r) => r.kind === 'time');
    if (option.requirement.kind === 'weather') return taken.some((r) => r.kind === 'weather');
    if (option.requirement.kind === 'opening') return taken.some((r) => r.kind === 'opening');
    return listed(option.requirement);
  };

  const renderText = (text: string) => <PlaceholderText text={text} placeholders={placeholders} />;
  const plainText = (text: string) => labelPlaceholders(text, placeholders);
  const targets = (heading: string, list: RequirementOption[]): BreadcrumbPickerSection<RequirementOption> => ({
    heading,
    rows: list.map((option) => ({
      // One stat can belong to several owners.
      key: `${option.requirement.kind}:${option.requirement.id}${option.requirement.kind === 'stat' ? `:${requirementOwnerKey(requirementOwnerOf(option.requirement))}` : ''}${option.requirement.kind === 'item' ? `:${option.requirement.status}` : ''}`,
      value: option,
      name: option.label,
      breadcrumb: option.breadcrumb,
      disabled: exhausted(option),
    })),
  });
  // Off-world only the entity's own stats exist to read.
  const shownStats = statSections.filter((s) => !offWorld || s.own);
  const shownItems = offWorld ? [] : options.items ?? [];
  const worldOptions = options.worldOptions ?? [];
  const searchable = joinAnd([
    'traits', 'groups', ...(shownStats.length ? ['stats'] : []), ...(shownItems.length ? ['items'] : []), 'time of day', ...(options.weather ? ['weather'] : []), ...(options.opening ? ['openings'] : []),
    ...(worldOptions.length ? ['World Options'] : []), ...(offWorld ? [] : ['personas']),
  ]);
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
    ...category('items', 'Items', (['owned', 'equipped'] as const).flatMap((status) => {
      const list = shownItems.filter((o) => o.requirement.kind === 'item' && o.requirement.status === status);
      return list.length ? [{ kind: 'section' as const, ...targets(status === 'owned' ? 'Owned' : 'Equipped', list) }] : [];
    })),
    ...category('time', 'Time of Day', [{ kind: 'section', ...targets('Time of Day', [TIME_OPTION]) }]),
    ...(options.weather ? category('weather', 'Weather', [{ kind: 'section', ...targets('Weather', options.weather) }]) : []),
    ...(options.opening ? category('opening', 'Opening', [{ kind: 'section', ...targets('Opening', options.opening) }]) : []),
    ...(worldOptions.length ? category('worldOptions', 'World Options', [{ kind: 'section', ...targets('World Options', worldOptions) }]) : []),
    ...(offWorld ? [] : category('playingAs', 'Playing As', [{ kind: 'section', ...targets('Playing As', options.personas) }])),
  ];

  const picker = (key: AddTarget, trigger: ReactElement) => (
    <BreadcrumbPicker
      tree={tree}
      onPick={pick}
      open={target === key}
      onOpenChange={(next) => setTarget(next ? key : null)}
      closeOnPick={false}
      searchPlaceholder={`Search ${searchable}`}
      renderText={renderText}
      plainText={plainText}
      trigger={trigger}
    />
  );

  const ctx: ClauseContext = { options, placeholders, offWorld, clausesOf, host: clauseHost, onOpen, opens };
  const textOf = (requirement: TraitRequirement) => plainText(clauseText(clausesOf(requirement, { host: clauseHost })));

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <div className="flex items-center gap-2"><Label id={labelId}>{label}</Label>{labelAside}</div>
      {hint && <Hint>{hint}</Hint>}
      {rows.length > 0 && (
        <ul className="space-y-0.5">
          {rows.map((row, i) => {
            const rowText = row.all.map(textOf).join(' and ');
            return (
              // Rows have no ids; an index key remounts nothing that holds state.
              <li key={i}>
                {i > 0 && <div className="pl-1 text-label leading-7 text-muted-foreground">or</div>}
                <div data-requirement-row="" className="flex items-start gap-1 rounded px-1 py-0.5 text-label leading-7 hover:bg-muted/40">
                  <p className="min-w-0 flex-1">
                    {row.all.map((requirement, j) => (
                      // One box per Condition: a box that does not fit moves to the next line whole, its "and" with it.
                      <Fragment key={`${requirement.kind}:${'id' in requirement ? requirement.id : ''}:${requirementOwnerKey(requirementOwnerOf(requirement))}:${j}`}>
                      {j > 0 && ' '}
                      <span data-clause="" className="inline-block max-w-full align-top">
                        <RequirementClause
                          requirement={requirement} ctx={ctx} first={j === 0}
                          edit={{ replace: (next) => replaceCondition(i, j, next), accepts: (next) => canReplace(i, j, next) }}
                        />
                        <button
                          type="button" aria-label={`Remove ${textOf(requirement)}`}
                          className="ml-0.5 inline-flex rounded-full p-0.5 align-middle text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          onClick={() => removeCondition(i, j)}
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                        {j < row.all.length - 1 ? ' and' : (
                          <>{' '}{picker(i, <button type="button" aria-label="Add a condition to this row" className={MUTED_SENTENCE_TOKEN_CLASS}>and…</button>)}</>
                        )}
                      </span>
                      </Fragment>
                    ))}
                  </p>
                  <Tip tip="Delete this row">
                    <Button
                      type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete row: ${rowText}`} onClick={() => onChange(rows.filter((_, k) => k !== i))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </Tip>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pl-1 text-label leading-7">
        {picker('new', (
          <button type="button" aria-label={rows.length ? 'Add another way' : undefined} className={MUTED_SENTENCE_TOKEN_CLASS}>
            {rows.length ? 'or…' : 'Add a requirement…'}
          </button>
        ))}
      </div>
    </div>
  );
}
