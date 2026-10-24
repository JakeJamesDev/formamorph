import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from './RequirementRowsField';
import { requirementStatSections } from '@/lib/requirementStatOptions';
import { conditionTexts, type GateInput, type GateStat, type GateStatSet, type RowState } from '@/lib/traitGates';
import { scoped, type OwnerId } from '@/lib/scope';
import type { TraitRequirement, TraitRequirementRow } from '@/types';

const S = (name: string, extra: Partial<GateStat> = {}): GateStat => ({ name, value: 10, min: 0, max: 100, ...extra });
const entities = [{ id: 'ash', name: 'Ash' }];
const input: Pick<GateInput, 'global' | 'owners' | 'entities' | 'stats'> = {
  global: { traits: [], groups: [] },
  owners: [],
  entities,
  stats: scoped<GateStatSet>({ rage: S('Rage'), gold: S('Gold') }, { ash: { hunger: S('Hunger') } }),
};
const textOf = conditionTexts(input);

/** The field over real stat sections and the real rule text, with edits that land. */
function Harness({ initial = [], owner = null, offWorld = false, onOpen = () => {} }: {
  initial?: TraitRequirementRow[];
  owner?: OwnerId;
  offWorld?: boolean;
  onOpen?: (r: TraitRequirement) => void;
}) {
  const [rows, setRows] = useState(initial);
  const states: RowState[] = rows.map((row) => ({
    holds: false,
    conditions: row.all.map((r) => ({ text: textOf(r), holds: false, unresolved: false, hidden: false })),
  }));
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} states={states} placeholders={[]} offWorld={offWorld}
        options={{ traits: [], groups: [], personas: [] }}
        statSections={requirementStatSections(input, owner)}
        textOf={textOf} onChange={setRows} onOpen={onOpen}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

const rows = (): TraitRequirementRow[] => JSON.parse(screen.getByTestId('rows').textContent!);
const addRage = async (label: RegExp = /^Add Requirement$|^Or Another Way$/) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: /^Rage/ }));
};
const chip = (name: string) => screen.getByRole('group', { name });
const operatorBox = () => screen.getByRole('combobox', { name: 'Operator' });
const pickOperator = async (name: string) => {
  await userEvent.click(operatorBox());
  await userEvent.click(await screen.findByRole('option', { name }));
};

// Q29: the picker's global section reads Global Stats.
describe('a stat Condition in the rows editor', () => {
  it('lists each owner’s stats and places a chip with an operator, a value and a unit', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(await screen.findByText('Global Stats')).toBeInTheDocument();
    expect(screen.getByText('Ash Stats')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Rage', 'Gold', 'Hunger', 'Time of Day']);

    fireEvent.click(screen.getByRole('option', { name: /^Rage/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' }] }]);
    const rage = chip('Rage >= 50');
    expect(within(rage).getByRole('combobox', { name: 'Operator' })).toHaveTextContent('>=');
    expect(within(rage).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Raw', '%']);
    expect(within(rage).getByRole('spinbutton', { name: 'Value' })).toHaveValue(50);
    await userEvent.click(operatorBox());
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['>', '<', '>=', '<=', '=', '≠']);
    for (const name of ['Greater than', 'Less than', 'Greater than or equal to', 'Less than or equal to', 'Equal to', 'Not equal to']) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('option', { name: 'Greater than or equal to' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Rage >= 50' })).not.toBeInTheDocument();
  });

  it('adds a stat under another owner with that owner on the chip', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Hunger/ }));
    expect(rows()[0].all[0]).toEqual({ kind: 'stat', id: 'hunger', owner: { kind: 'entity', id: 'ash', name: 'Ash' }, operator: '>=', value: 50, unit: 'raw' });
    expect(chip('Ash: Hunger >= 50')).toBeInTheDocument();
  });

  it('updates the chip text as the operator and the value change', async () => {
    render(<Harness />);
    await addRage();
    await pickOperator('Less than');
    expect(chip('Rage < 50')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '80' } });
    expect(chip('Rage < 80')).toBeInTheDocument();
    expect(rows()[0].all[0]).toMatchObject({ operator: '<', value: 80, unit: 'raw' });
  });

  it('keeps the value when the unit switches from raw to %', async () => {
    render(<Harness />);
    await addRage();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Percent' }));
    expect(chip('Rage >= 80%')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Value' })).toHaveValue(80);
    fireEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(chip('Rage >= 80')).toBeInTheDocument();
  });

  it('keeps a typed minus sign and a cleared field as a draft, and commits only a number', async () => {
    render(<Harness />);
    await addRage();
    const value = screen.getByRole('spinbutton', { name: 'Value' });
    fireEvent.change(value, { target: { value: '' } });
    expect(rows()[0].all[0]).toMatchObject({ value: 50 });
    fireEvent.change(value, { target: { value: '-5' } });
    expect(chip('Rage >= -5')).toBeInTheDocument();
    fireEvent.change(value, { target: { value: '' } });
    fireEvent.blur(value);
    expect(value).toHaveValue(-5);
  });

  it('flips to Not like any chip, and reads "not Rage >= 80"', async () => {
    render(<Harness initial={[{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 80, unit: 'raw' }] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Require Rage >= 80 to be off' }));
    expect(rows()[0].all[0]).toMatchObject({ id: 'rage', not: true });
    expect(chip('not Rage >= 80')).toBeInTheDocument();
    expect(screen.getByText('NOT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove not Rage >= 80' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Require Rage >= 80 instead' }));
    expect(rows()[0].all[0]).not.toHaveProperty('not');
  });

  it('accepts "Rage < 80" after "Rage > 20", not refused as a duplicate', async () => {
    render(<Harness initial={[{ all: [{ kind: 'stat', id: 'rage', operator: '>', value: 20, unit: 'raw' }] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'And' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Rage/ }));
    expect(rows()[0].all).toHaveLength(2);
    const second = screen.getByRole('group', { name: 'Rage >= 50' });
    await userEvent.click(within(second).getByRole('combobox', { name: 'Operator' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Less than' }));
    fireEvent.change(within(second).getByRole('spinbutton', { name: 'Value' }), { target: { value: '80' } });
    expect(rows()[0].all.map((c) => c.kind === 'stat' && `${c.operator} ${c.value}`)).toEqual(['> 20', '< 80']);
  });

  it('refuses an edit that would repeat another Condition in the row', async () => {
    const stat = (operator: '>' | '<', value: number): TraitRequirement => ({ kind: 'stat', id: 'rage', operator, value, unit: 'raw' });
    render(<Harness initial={[{ all: [stat('>', 20), stat('<', 20)] }]} />);
    const [, second] = screen.getAllByRole('group', { name: /^Rage/ });
    await userEvent.click(within(second).getByRole('combobox', { name: 'Operator' }));
    expect(await screen.findByRole('option', { name: 'Greater than' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'Less than' })).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    fireEvent.change(within(second).getByRole('spinbutton', { name: 'Value' }), { target: { value: '30' } });
    expect(rows()[0].all[1]).toMatchObject({ operator: '<', value: 30 });
  });

  it('holds a number that would repeat another Condition as a draft, then puts the real one back on blur', async () => {
    const stat = (operator: '>' | '<', value: number): TraitRequirement => ({ kind: 'stat', id: 'rage', operator, value, unit: 'raw' });
    render(<Harness initial={[{ all: [stat('<', 80), stat('<', 20)] }]} />);
    const [, second] = screen.getAllByRole('group', { name: /^Rage/ });
    const value = within(second).getByRole('spinbutton', { name: 'Value' });
    fireEvent.change(value, { target: { value: '80' } });
    expect(rows()[0].all[1]).toMatchObject({ value: 20 });
    expect(value).toHaveValue(80);
    fireEvent.blur(value);
    expect(value).toHaveValue(20);
  });

  it('disables a unit that would repeat another Condition in the row', async () => {
    const stat = (unit: 'raw' | 'percent'): TraitRequirement => ({ kind: 'stat', id: 'rage', operator: '>', value: 20, unit });
    render(<Harness initial={[{ all: [stat('raw'), stat('percent')] }]} />);
    const [first, second] = screen.getAllByRole('group', { name: /^Rage/ });
    expect(within(first).getByRole('radio', { name: 'Percent' })).toBeDisabled();
    expect(within(second).getByRole('radio', { name: 'Raw' })).toBeDisabled();
  });

  it('disables a stat whose default Condition is already listed', async () => {
    render(<Harness initial={[{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' }] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'And' }));
    expect(await screen.findByRole('option', { name: /^Rage/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /^Gold/ })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('reads a stat chip as plain text: it opens nothing', async () => {
    const onOpen = vi.fn();
    render(<Harness initial={[{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 80, unit: 'raw' }] }]} onOpen={onOpen} />);
    expect(within(chip('Rage >= 80')).queryByRole('button', { name: /^Rage$/ })).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('offers only the host’s own stats off-world, where nothing else exists', async () => {
    render(<Harness owner="ash" offWorld />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(await screen.findByText('Ash Stats')).toBeInTheDocument();
    expect(screen.queryByText('Global Stats')).not.toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Hunger', 'Time of Day']);
  });
});
