import { useMemo, type ReactNode } from 'react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { RequirementRowsField } from '@/components/editor/RequirementRowsField';
import { conditionClauses, isBlueprintTrait, ownerHolding, requirementOptions, type ClauseHost } from '@/lib/traitGates';
import { SELF_ENTITY } from '@/lib/portableTraits';
import { joinAnd, summarizeRequirement } from '@/lib/requirementSummary';
import { requirementTargets } from '@/lib/requirementTargets';
import type { Trait, TraitRequirement, TraitRequirementRow } from '@/types';
import { Hint } from '@/components/ui/typography';

/**
 * The rows read back as Needs, then Plus One Of (Needs One Of with no Needs line), then Blocked By last, so
 * "plus" never follows a blocker list.
 */
export function RequirementSummaryText({ rows, name }: { rows: TraitRequirementRow[]; name: (c: TraitRequirement) => string }) {
  const summary = summarizeRequirement(rows);
  if (!summary) return <Hint>Always available</Hint>;
  const names = (list: TraitRequirement[]) => list.map(name);
  const blocked = names(summary.blocked);
  return (
    <Hint as="div" data-requirement-summary="" className="space-y-0.5">
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
    </Hint>
  );
}

/** `clausesOf` reading a library entity's portable self-reference as the entity that holds the trait. */
const selfBound = (clausesOf: ReturnType<typeof conditionClauses>, ownerId: string | null): ReturnType<typeof conditionClauses> =>
  (ownerId === null ? clausesOf : (req, view) => {
    if (req.kind === 'playingAs' && req.id === SELF_ENTITY) return clausesOf({ ...req, id: ownerId }, view);
    if ('owner' in req && req.owner?.kind === 'entity' && req.owner.id === SELF_ENTITY) {
      // The spread loses the union's discriminant link; the kind and its fields are unchanged.
      return clausesOf({ ...req, owner: { ...req.owner, id: ownerId } } as TraitRequirement, view);
    }
    return clausesOf(req, view);
  });

/**
 * The trait panel's Requires field: the trait's Requirement Rows over the trait store. `ownerId` names the
 * owner whose sentences the rows read, for a link whose rows differ from its original's; without it, the first
 * owner holding the trait.
 */
export function TraitRequiresField({ trait, onChange, onOpen, opens, ownerId, labelAside }: {
  trait: Trait;
  onChange: (requires: TraitRequirementRow[]) => void;
  onOpen: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
  ownerId?: string;
  labelAside?: ReactNode;
}) {
  const { gateInput, placeholders, offWorld } = useTraitStore();
  const { targets, options, clausesOf, clauseHost } = useMemo(() => {
    // A link's owner when the input holds it, else the first owner holding the trait.
    const linked = ownerId !== undefined ? gateInput.owners.find((o) => o.id === ownerId) : undefined;
    const hostOwnerId = linked?.id ?? ownerHolding(gateInput, trait.id)?.id ?? null;
    const owner = hostOwnerId === null ? undefined : gateInput.owners.find((o) => o.id === hostOwnerId);
    const blueprint = hostOwnerId === null && isBlueprintTrait(gateInput, trait.id);
    const host: ClauseHost = hostOwnerId !== null ? { kind: 'entity', id: hostOwnerId, name: owner?.name } : { kind: blueprint ? 'blueprint' : 'world' };
    return {
      targets: requirementTargets(gateInput, host, trait.id),
      options: requirementOptions(gateInput),
      clausesOf: selfBound(conditionClauses(gateInput), hostOwnerId),
      clauseHost: host,
    };
  }, [gateInput, trait.id, ownerId]);

  return (
    <RequirementRowsField
      rows={trait.requires ?? []}
      targets={targets}
      options={options}
      clausesOf={clausesOf}
      clauseHost={clauseHost}
      placeholders={placeholders}
      offWorld={offWorld}
      onChange={onChange}
      onOpen={onOpen}
      opens={opens}
      labelAside={labelAside}
    />
  );
}
