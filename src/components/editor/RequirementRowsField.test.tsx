import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from './RequirementRowsField';
import type { RequirementOption, RequirementOptions, RowState } from '@/lib/traitGates';
import type { TraitRequirement, TraitRequirementRow } from '@/types';
import { PLAYER_OWNER } from '@/lib/traitGates';

const brave: TraitRequirement = { kind: 'trait', id: 'brave' };
const option = (requirement: TraitRequirement, label: string): RequirementOption =>
  ({ requirement, label, breadcrumb: ['Traits'], owners: [] });
const options = {
  traits: [option(brave, 'Brave'), option({ kind: 'trait', id: 'wise' }, 'Wise')],
  groups: [], personas: [],
};
const textOf = (r: TraitRequirement) => `${r.not ? 'not ' : ''}${r.id === 'brave' ? 'Brave' : 'Wise'}`;

/** The field with no trait and no store: rows, an owner and the data the host would derive. */
function Harness({ initial = [], owner = 'image-1', offWorld = true, choices = options }: {
  initial?: TraitRequirementRow[];
  owner?: string;
  offWorld?: boolean;
  choices?: RequirementOptions;
}) {
  const [rows, setRows] = useState(initial);
  const states: RowState[] = rows.map((row) => ({
    holds: false,
    conditions: row.all.map((r) => ({ text: textOf(r), holds: false, unresolved: false, hidden: false })),
  }));
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} owner={owner} states={states} options={choices} textOf={textOf}
        placeholders={[]} offWorld={offWorld} onChange={setRows} onOpen={() => {}}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

describe('RequirementRowsField without a trait or a store', () => {
  it('adds a row, adds a Condition with And, flips it to Not and removes it', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
    expect(screen.getByRole('button', { name: 'Brave' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'And' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Wise/ }));
    expect(document.querySelector('[data-requirement-row]')?.textContent).toContain('Brave');
    expect(document.querySelector('[data-requirement-row]')?.textContent).toContain('Wise');

    fireEvent.click(screen.getByRole('button', { name: 'Require Wise to be off' }));
    expect(JSON.parse(screen.getByTestId('rows').textContent!)).toEqual([
      { all: [brave, { kind: 'trait', id: 'wise', not: true }] },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Remove not Wise' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Brave' }));
    expect(screen.getByTestId('rows').textContent).toBe('[]');
    expect(screen.getByRole('button', { name: 'Add Requirement' })).toBeInTheDocument();
  });

  it('offers Or Another Way beside an existing row and lists the new row after "or"', async () => {
    render(<Harness initial={[{ all: [brave] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Or Another Way' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Wise/ }));
    expect([...document.querySelectorAll('[data-requirement-row]')].map((r) => r.textContent)).toHaveLength(2);
    expect(screen.getByText('or')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wise' })).toBeInTheDocument();
  });

  describe('with one owner for the target, in a world', () => {
    const single: RequirementOptions = {
      ...options,
      traits: [{ ...options.traits[0], owners: [{ owner: { kind: 'you' }, name: 'You' }] }],
    };

    it('adds at once when the owner is the world root', async () => {
      render(<Harness owner={PLAYER_OWNER} offWorld={false} choices={single} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
      fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
      expect(screen.getByRole('button', { name: 'Brave' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Back to targets' })).not.toBeInTheDocument();
    });

    it('asks which owner when the host is another owner, such as an image\'s entity', async () => {
      render(<Harness owner="image-1" offWorld={false} choices={single} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
      fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
      expect(screen.getByRole('button', { name: 'Back to targets' })).toBeInTheDocument();
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Same OwnerWhoever has the trait', 'You']);
    });
  });
});
