import { useState } from 'react';
import { screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from '@/components/editor/RequirementRowsField';
import { conditionClauses, requirementOptions, type ClauseHost, type GateInput, type RequirementOptions } from '@/lib/traitGates';
import type { RequirementStatSection } from '@/lib/requirementStatOptions';
import type { TraitRequirement, TraitRequirementRow } from '@/types';

export type FieldInput = Omit<GateInput, 'active' | 'persona'>;

export const EMPTY_INPUT: FieldInput = { global: { traits: [], groups: [] }, owners: [], entities: [] };

/** The Requires field over a real gate input's clauses and options, with edits that land in an `<output>`. */
export function FieldHarness({
  input = EMPTY_INPUT, initial = [], options, host = { kind: 'entity' }, offWorld = false, statSections, hostName, onOpen = () => {}, opens,
}: {
  input?: FieldInput;
  initial?: TraitRequirementRow[];
  /** Absent, the input's own options. */
  options?: RequirementOptions;
  host?: ClauseHost;
  offWorld?: boolean;
  statSections?: readonly RequirementStatSection[];
  hostName?: string;
  onOpen?: (requirement: TraitRequirement) => void;
  opens?: (requirement: TraitRequirement) => boolean;
}) {
  const [rows, setRows] = useState(initial);
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} options={options ?? requirementOptions(input, '')} statSections={statSections} clausesOf={conditionClauses(input)} clauseHost={host}
        placeholders={[]} offWorld={offWorld} hostName={hostName} onChange={setRows} onOpen={onOpen} opens={opens}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

/** The rows the last edit wrote. */
export const writtenRows = (): TraitRequirementRow[] => JSON.parse(screen.getByTestId('rows').textContent!);

/** Each row's sentence as the author reads it. */
export const sentences = () => [...document.querySelectorAll('[data-requirement-row] p')].map((p) => p.textContent?.replace(/\s+/g, ' ').trim());

export const ADD_FIRST = 'Add a requirement…';
export const ADD_ROW = 'Add another way';
export const ADD_TO_ROW = 'Add a condition to this row';
