import { useMemo, type ReactNode } from 'react';
import { Check, Info, Lock } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Hint } from '@/components/ui/typography';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { choiceRowClass } from './setupChoiceRow';
import { cn } from '@/lib/utils';
import { WORLD_OWNER, gateOf, type GateStates, type GroupPickState } from '@/lib/traitGates';
import { gateLine } from '@/lib/traitGateLine';
import { isAlwaysOn, isDormant, isShown } from '@/lib/traitEffects';
import type { Stat, StatChange, Trait, TraitGroup } from '@/types';

/** What the last selection change turned off, by name, and the pick that caused it. */
export interface TraitCascade {
  off: string[];
  because: string;
}

const LIST = new Intl.ListFormat('en', { type: 'conjunction' });

/** The banner after a selection change turns gated traits off. It renders last in its scroll host and sticks
 *  to the host's bottom edge, so the rows above it never move when it appears. */
export function TraitCascadeNotice({ cascade, onDismiss }: { cascade: TraitCascade; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="sticky bottom-0 z-10 mt-4 flex items-start gap-2 rounded-lg border bg-background p-3 text-helper shadow-md animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="flex-1">Turned off <strong>{LIST.format(cascade.off)}</strong>, because of {cascade.because}.</span>
      <Button type="button" variant="ghost" size="sm" className="-my-1 h-7" onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

/**
 * One trait category of the setup screen: its heading, the Player-Facing Descriptions of the groups it
 * sits in, and its traits with their stat changes. A max-one category is a radio choice; a full category with
 * a larger max disables its unchecked rows. A short category says how many more picks it needs. An active
 * Always On trait shows checked with no control. A dormant one and a Hidden one don't show.
 */
export function SetupTraitList({
  name, groups, traits, picks, stats, selectedTraits, resolveText, resolveTraitText, onTraitSelect,
  ownerId = WORLD_OWNER, gates, cascade, onDismissCascade, heading,
}: {
  name: string;
  /** Replaces the eyebrow and the name heading. */
  heading?: ReactNode;
  /** The groups from the root down to this category's own. */
  groups: TraitGroup[];
  /** This category's traits, in authored order. */
  traits: Trait[];
  /** The category's own group's pick state for this bearer; absent for traits outside any group. */
  picks?: GroupPickState | null;
  stats: Stat[];
  /** The bearer's picks. */
  selectedTraits: readonly string[];
  resolveText: (text: string) => string;
  resolveTraitText: (trait: Trait, text: string) => string;
  /** The player's pick of one of this bearer's traits. */
  onTraitSelect: (traitId: string, ownerId: string) => void;
  /** The bearer whose traits these are; the world's by default. */
  ownerId?: string;
  /** Each bearer's gates; absent shows every trait open. */
  gates?: GateStates;
  cascade?: TraitCascade | null;
  onDismissCascade?: () => void;
}) {
  const statById = useMemo(() => new Map(stats.map((stat) => [stat.id, stat])), [stats]);
  const radio = picks?.max === 1;
  const needed = picks ? picks.min - picks.count : 0;
  const shown = traits.filter((trait) => isShown(trait, selectedTraits));
  const selectedRadio = shown.find((trait) => !isAlwaysOn(trait) && selectedTraits.includes(trait.id))?.id;
  // A max-one group's active Always On trait can't be swapped out.
  const fixedRadio = radio && traits.some((trait) => isAlwaysOn(trait) && !isDormant(trait, selectedTraits));
  const rows = shown.map((trait) => {
    const selected = selectedTraits.includes(trait.id);
    const fixed = isAlwaysOn(trait);
    const gate = gates && gateOf(gates, ownerId, trait.id);
    const locked = gate?.unlocked === false;
    const disabled = locked || (!selected && (radio ? fixedRadio : !!picks?.full));
    const line = gateLine(gate);
    const description = resolveTraitText(trait, trait.playerDescription ?? '').trim();
    const changes = trait.statChanges
      .map((change) => ({ change, stat: statById.get(change.statId) }))
      .filter((row): row is { change: StatChange; stat: Stat } => row.stat !== undefined && row.stat.hidden !== true);
    return (
      <div
        key={trait.id}
        className={cn(choiceRowClass(selected), disabled && 'cursor-not-allowed opacity-60 hover:border-border hover:bg-card')}
      >
        {fixed ? (
          <Check role="img" aria-label="Always On" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : radio ? (
          <RadioGroupItem
            id={`setup-trait-${trait.id}`}
            value={trait.id}
            aria-label={trait.name}
            disabled={disabled}
            className="mt-0.5 shrink-0"
            onClick={(event) => {
              if (selected) {
                event.preventDefault();
                onTraitSelect(trait.id, ownerId);
              }
            }}
          />
        ) : (
          <Checkbox
            id={`setup-trait-${trait.id}`}
            checked={selected}
            disabled={disabled}
            aria-label={trait.name}
            className="mt-0.5 shrink-0"
            onCheckedChange={() => onTraitSelect(trait.id, ownerId)}
          />
        )}
        <label
          htmlFor={`setup-trait-${trait.id}`}
          className={cn('min-w-0 flex-1', fixed ? undefined : disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        >
          <strong className="flex items-center gap-2 text-label font-semibold">
            {trait.name}
            {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          </strong>
          {description && <span className="mt-1 block text-helper text-muted-foreground">{description}</span>}
          {line && (
            <span className={cn('mt-1 block text-meta', locked ? 'text-foreground' : 'text-muted-foreground')}>{line}</span>
          )}
          {changes.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-helper text-muted-foreground">
              {changes.map(({ change, stat }, index) => (
                <li key={index}>
                  {resolveTraitText(trait, stat.name)}:{' '}
                  <span className={change.value > 0 ? 'text-success' : 'text-destructive'}>
                    {change.value > 0 ? '+' : ''}{change.value}
                  </span>
                  {change.type && change.type !== 'starting' ? ` (${change.type})` : ''}
                </li>
              ))}
            </ul>
          )}
        </label>
      </div>
    );
  });

  return (
    <>
      {heading ?? (
        <>
          <p className="mb-1 text-meta font-medium tracking-wide text-muted-foreground">Starting Traits</p>
          <h2 className="mb-3 text-heading font-semibold">{name}</h2>
        </>
      )}
      {groups.map((group) => group.playerDescription?.trim() && (
        <div key={group.id} className="mb-2 max-w-3xl text-helper text-muted-foreground">
          <MarkdownRenderer text={resolveText(group.playerDescription)} />
        </div>
      ))}
      <fieldset className="mt-4 min-w-0">
        <legend className="sr-only">{name} choices</legend>
        {radio ? (
          <RadioGroup
            value={selectedRadio ?? ''}
            onValueChange={(traitId) => onTraitSelect(traitId, ownerId)}
            className="grid min-w-0 gap-3 xl:grid-cols-2"
          >
            {rows}
          </RadioGroup>
        ) : (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">{rows}</div>
        )}
      </fieldset>
      {needed > 0 && <Hint className="mt-3">Choose {needed} more {needed === 1 ? 'trait' : 'traits'}</Hint>}
      {cascade && onDismissCascade && <TraitCascadeNotice cascade={cascade} onDismiss={onDismissCascade} />}
    </>
  );
}
