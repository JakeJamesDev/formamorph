import { useMemo } from 'react';
import { Info, Lock } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { choiceRowClass } from './setupChoiceRow';
import { cn } from '@/lib/utils';
import type { GateState } from '@/lib/traitGates';
import type { Stat, StatChange, Trait, TraitGroup } from '@/types';

/** What the last selection change turned off, by name, and the pick that caused it. */
export interface TraitCascade {
  off: string[];
  because: string;
}

const LIST = new Intl.ListFormat('en', { type: 'conjunction' });
const OR = new Intl.ListFormat('en', { type: 'disjunction' });

/** The banner after a selection change turns gated traits off. */
export function TraitCascadeNotice({ cascade, onDismiss }: { cascade: TraitCascade; onDismiss: () => void }) {
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-helper">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="flex-1">Turned off <strong>{LIST.format(cascade.off)}</strong>, because of {cascade.because}.</span>
      <Button type="button" variant="ghost" size="sm" className="-my-1 h-7" onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

/** "Requires A or B" for a locked trait, "Unlocked by A" for an open one, nothing for an ungated one. */
function gateLine(gate: GateState | undefined): string | null {
  if (!gate?.requirements.length) return null;
  if (!gate.unlocked) return `Requires ${OR.format(gate.requirements.map((r) => r.text))}`;
  return `Unlocked by ${OR.format(gate.requirements.filter((r) => r.holds).map((r) => r.text))}`;
}

/**
 * One trait category of the setup screen: its heading, the Player-Facing Descriptions of the groups it
 * sits in, and its traits with their stat changes. An exclusive category holds at most one trait.
 */
export function SetupTraitList({
  name, groups, traits, exclusive, stats, selectedTraits, resolveText, resolveTraitText, onTraitSelect,
  gates, cascade, onDismissCascade,
}: {
  name: string;
  /** The groups from the root down to this category's own. */
  groups: TraitGroup[];
  /** This category's traits, in authored order. */
  traits: Trait[];
  exclusive?: boolean;
  stats: Stat[];
  selectedTraits: string[];
  resolveText: (text: string) => string;
  resolveTraitText: (trait: Trait, text: string) => string;
  onTraitSelect: (traitId: string) => void;
  /** Each trait's gate; absent shows every trait open. */
  gates?: ReadonlyMap<string, GateState>;
  cascade?: TraitCascade | null;
  onDismissCascade?: () => void;
}) {
  const statById = useMemo(() => new Map(stats.map((stat) => [stat.id, stat])), [stats]);
  const selectedExclusive = traits.find((trait) => selectedTraits.includes(trait.id))?.id;
  const rows = traits.map((trait) => {
    const selected = selectedTraits.includes(trait.id);
    const gate = gates?.get(trait.id);
    const locked = gate?.unlocked === false;
    const line = gateLine(gate);
    const description = resolveTraitText(trait, trait.playerDescription ?? '').trim();
    const changes = trait.statChanges
      .map((change) => ({ change, stat: statById.get(change.statId) }))
      .filter((row): row is { change: StatChange; stat: Stat } => row.stat !== undefined && row.stat.hidden !== true);
    return (
      <div
        key={trait.id}
        className={cn(choiceRowClass(selected), locked && 'cursor-not-allowed opacity-60 hover:border-border hover:bg-card')}
      >
        {exclusive ? (
          <RadioGroupItem
            id={`setup-trait-${trait.id}`}
            value={trait.id}
            aria-label={trait.name}
            disabled={locked}
            className="mt-0.5 shrink-0"
            onClick={(event) => {
              if (selected) {
                event.preventDefault();
                onTraitSelect(trait.id);
              }
            }}
          />
        ) : (
          <Checkbox
            id={`setup-trait-${trait.id}`}
            checked={selected}
            disabled={locked}
            aria-label={trait.name}
            className="mt-0.5 shrink-0"
            onCheckedChange={() => onTraitSelect(trait.id)}
          />
        )}
        <label
          htmlFor={`setup-trait-${trait.id}`}
          className={cn('min-w-0 flex-1', locked ? 'cursor-not-allowed' : 'cursor-pointer')}
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
      <p className="mb-1 text-meta font-medium tracking-wide text-muted-foreground">Starting Traits</p>
      <h2 className="mb-3 text-heading font-semibold">{name}</h2>
      {groups.map((group) => group.playerDescription?.trim() && (
        <div key={group.id} className="mb-2 max-w-3xl text-helper text-muted-foreground">
          <MarkdownRenderer text={resolveText(group.playerDescription)} />
        </div>
      ))}
      {cascade && onDismissCascade && <TraitCascadeNotice cascade={cascade} onDismiss={onDismissCascade} />}
      <fieldset className="mt-4 min-w-0">
        <legend className="sr-only">{name} choices</legend>
        {exclusive ? (
          <RadioGroup
            value={selectedExclusive ?? ''}
            onValueChange={onTraitSelect}
            className="grid min-w-0 gap-3 xl:grid-cols-2"
          >
            {rows}
          </RadioGroup>
        ) : (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">{rows}</div>
        )}
      </fieldset>
    </>
  );
}
