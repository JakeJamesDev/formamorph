import { useMemo, type ReactNode } from 'react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { RequirementRowsField } from '@/components/editor/RequirementRowsField';
import { WORLD_OWNER, conditionTexts, gateOf, gateStates, ownerHolding, requirementOptions } from '@/lib/traitGates';
import { joinAnd, summarizeRequirement } from '@/lib/requirementSummary';
import { requirementStatSections } from '@/lib/requirementStatOptions';
import type { Trait, TraitRequirement, TraitRequirementRow } from '@/types';

/**
 * The rows read back as Needs, then Plus One Of (Needs One Of with no Needs line), then Blocked By last, so
 * "plus" never follows a blocker list.
 */
export function RequirementSummaryText({ rows, name }: { rows: TraitRequirementRow[]; name: (c: TraitRequirement) => string }) {
  const summary = summarizeRequirement(rows);
  if (!summary) return <p className="text-helper text-muted-foreground">Always available</p>;
  const names = (list: TraitRequirement[]) => list.map(name);
  const blocked = names(summary.blocked);
  return (
    <div data-requirement-summary="" className="space-y-0.5 text-helper text-muted-foreground">
      {summary.needs.length > 0 && <p><span className="font-medium text-foreground">Needs:</span> {joinAnd(names(summary.needs))}</p>}
      {summary.options.length > 0 && (
        <>
          <p className="font-medium text-foreground">{summary.needs.length ? 'Plus One Of:' : 'Needs One Of:'}</p>
          <ul className="list-disc pl-5">
            {summary.options.map((option, i) => {
              const needs = joinAnd(names(option.needs));
              const by = option.blocked.length ? `blocked by ${joinAnd(names(option.blocked))}` : '';
              // Options have no ids; the list is rebuilt from the rows on every render.
              return <li key={i}>{needs && by ? `${needs}, ${by}` : needs || by}</li>;
            })}
          </ul>
        </>
      )}
      {blocked.length > 0 && (
        <p><span className="font-medium text-foreground">Blocked By:</span> {blocked.length === 2 ? blocked.join(' and ') : blocked.join(', ')}</p>
      )}
    </div>
  );
}

/**
 * The trait panel's Requires field: the trait's Requirement Rows over the trait store. `bearerId` names the
 * bearer whose gate the chips read, for a link whose rows differ from its original's; without it, the first
 * bearer holding the trait.
 */
export function TraitRequiresField({ trait, onChange, onOpen, opens, bearerId, labelAside }: {
  trait: Trait;
  onChange: (requires: TraitRequirementRow[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
  bearerId?: string;
  labelAside?: ReactNode;
}) {
  const { gateInput, placeholders, offWorld } = useTraitStore();
  const { states, options, statSections, owner, textOf } = useMemo(() => {
    const gates = gateStates(gateInput);
    const holder = ownerHolding(gateInput.owners, trait.id)?.id ?? WORLD_OWNER;
    const gate = (bearerId !== undefined ? gateOf(gates, bearerId, trait.id) : undefined) ?? gateOf(gates, holder, trait.id);
    return {
      states: gate?.rows ?? [], options: requirementOptions(gateInput, trait.id), owner: bearerId ?? holder,
      statSections: requirementStatSections(gateInput, bearerId ?? holder),
      textOf: conditionTexts(gateInput),
    };
  }, [gateInput, trait.id, bearerId]);

  return (
    <RequirementRowsField
      rows={trait.requires ?? []}
      owner={owner}
      states={states}
      options={options}
      statSections={statSections}
      textOf={textOf}
      placeholders={placeholders}
      offWorld={offWorld}
      onChange={onChange}
      onOpen={onOpen}
      opens={opens}
      labelAside={labelAside}
    />
  );
}
