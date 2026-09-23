import { useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { choiceRowClass } from './setupChoiceRow';
import type { Stat, StatChange, Trait, TraitGroup } from '@/types';

/**
 * One trait category of the setup screen: its heading, the Player-Facing Descriptions of the groups it
 * sits in, and its traits with their stat changes. An exclusive category holds at most one trait.
 */
export function SetupTraitList({
  name, groups, traits, exclusive, stats, selectedTraits, resolveText, resolveTraitText, onTraitSelect,
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
}) {
  const statById = useMemo(() => new Map(stats.map((stat) => [stat.id, stat])), [stats]);
  const selectedExclusive = traits.find((trait) => selectedTraits.includes(trait.id))?.id;
  const rows = traits.map((trait) => {
    const selected = selectedTraits.includes(trait.id);
    const description = resolveTraitText(trait, trait.playerDescription ?? '').trim();
    const changes = trait.statChanges
      .map((change) => ({ change, stat: statById.get(change.statId) }))
      .filter((row): row is { change: StatChange; stat: Stat } => row.stat !== undefined && row.stat.hidden !== true);
    return (
      <div key={trait.id} className={choiceRowClass(selected)}>
        {exclusive ? (
          <RadioGroupItem
            id={`setup-trait-${trait.id}`}
            value={trait.id}
            aria-label={trait.name}
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
            aria-label={trait.name}
            className="mt-0.5 shrink-0"
            onCheckedChange={() => onTraitSelect(trait.id)}
          />
        )}
        <label htmlFor={`setup-trait-${trait.id}`} className="min-w-0 flex-1 cursor-pointer">
          <strong className="block text-label font-semibold">{trait.name}</strong>
          {description && <span className="mt-1 block text-helper text-muted-foreground">{description}</span>}
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
