import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from './RequirementRowsField';
import { conditionTexts, type GateInput, type RowState } from '@/lib/traitGates';
import type { TraitRequirementRow } from '@/types';

const input: Pick<GateInput, 'global' | 'owners' | 'entities' | 'worldItems'> = {
  global: { traits: [], groups: [] },
  owners: [],
  entities: [],
  worldItems: [{ id: 'lamp', name: 'Lantern' }],
};
const textOf = conditionTexts(input);
const lit: TraitRequirementRow = { all: [{ kind: 'item', id: 'lamp', status: 'owned', state: 'lit' }] };

function Harness({ initial }: { initial: TraitRequirementRow[] }) {
  const [rows, setRows] = useState(initial);
  const states: RowState[] = rows.map((row) => ({
    holds: false, conditions: row.all.map((r) => ({ text: textOf(r), holds: false, unresolved: false, hidden: false })),
  }));
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} states={states} placeholders={[]} options={{ traits: [], groups: [], personas: [] }}
        textOf={textOf} onChange={setRows} onOpen={() => {}}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

const rows = (): TraitRequirementRow[] => JSON.parse(screen.getByTestId('rows').textContent!);

describe('an item Condition in the rows editor', () => {
  it('shows the name and both fields, with the checks out of the name', () => {
    render(<Harness initial={[lit]} />);
    const chip = screen.getByRole('group', { name: 'owning Lantern (lit)' });
    expect(chip.textContent).toContain('owning Lantern');
    expect(chip.textContent).not.toContain('(lit)');
    expect(screen.getByRole('textbox', { name: 'State' })).toHaveValue('lit');
    expect(screen.getByRole('combobox', { name: 'Identity' })).toHaveTextContent('Any');
  });

  it('writes the State word, and clears it when blank', () => {
    render(<Harness initial={[{ all: [{ kind: 'item', id: 'lamp', status: 'owned' }] }]} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'State' }), { target: { value: ' Lit ' } });
    expect(rows()[0].all[0]).toMatchObject({ state: 'Lit' });
    fireEvent.change(screen.getByRole('textbox', { name: 'State' }), { target: { value: '' } });
    expect(rows()[0].all[0]).not.toHaveProperty('state');
  });

  it('sets and clears the identity', async () => {
    render(<Harness initial={[lit]} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Identity' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Unidentified' }));
    expect(rows()[0].all[0]).toMatchObject({ state: 'lit', identity: 'unidentified' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Identity' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Any' }));
    expect(rows()[0].all[0]).not.toHaveProperty('identity');
  });
});
