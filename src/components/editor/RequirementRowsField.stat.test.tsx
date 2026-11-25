import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADD_FIRST, ADD_TO_ROW, FieldHarness, sentences, writtenRows, type FieldInput } from '@/test/requirementRows';
import { requirementStatSections } from '@/lib/requirementStatOptions';
import type { GateStat, GateStatSet } from '@/lib/traitGates';
import { scoped, type OwnerId } from '@/lib/scope';
import type { TraitRequirement, TraitRequirementRow } from '@/types';

const S = (name: string, extra: Partial<GateStat> = {}): GateStat => ({ name, value: 10, min: 0, max: 100, ...extra });
const input: FieldInput = {
  global: { traits: [], groups: [] },
  owners: [],
  entities: [{ id: 'ash', name: 'Ash' }],
  stats: scoped<GateStatSet>({ rage: S('Rage'), gold: S('Gold') }, { ash: { hunger: S('Hunger') } }),
};

/** The field over real stat sections and the real clauses, with edits that land. The host is the world, or `owner`. */
function Harness({ initial = [], owner = null, offWorld = false, onOpen = () => {} }: {
  initial?: TraitRequirementRow[];
  owner?: OwnerId;
  offWorld?: boolean;
  onOpen?: (r: TraitRequirement) => void;
}) {
  return (
    <FieldHarness
      input={input} initial={initial} offWorld={offWorld} onOpen={onOpen} options={{ traits: [], groups: [], personas: [] }}
      statSections={requirementStatSections(input, owner)} host={owner === null ? { kind: 'world' } : { kind: 'entity', id: owner, name: 'Ash' }}
    />
  );
}

const rows = writtenRows;
const addRage = async (label: string = ADD_FIRST) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: /^Rage/ }));
};
/** A stat Condition's token by its sentence; the rest of the page hides while a token's popover is open. */
const token = (sentence: string) => screen.getByRole('button', { name: `Edit ${sentence}`, hidden: true });
const openToken = (sentence: string) => fireEvent.click(token(sentence));
const operatorBox = () => screen.getByRole('combobox', { name: 'Operator' });
const pickOperator = async (name: string) => {
  await userEvent.click(operatorBox());
  await userEvent.click(await screen.findByRole('option', { name }));
};
const stat = (operator: '>' | '<' | '>=', value: number, unit: 'raw' | 'percent' = 'raw'): TraitRequirement => ({ kind: 'stat', id: 'rage', operator, value, unit });

// Q29: the picker's global section reads Global Stats.
describe('a stat Condition in the rows editor', () => {
  it('lists each owner’s stats and places a token whose popover holds an operator, a value and a unit', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(await screen.findByText('Global Stats')).toBeInTheDocument();
    expect(screen.getByText('Ash Stats')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Rage', 'Gold', 'Hunger', 'Time of Day']);

    fireEvent.click(screen.getByRole('option', { name: /^Rage/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' }] }]);
    expect(sentences()).toEqual(['Rage is at least 50 and…']);
    openToken('Rage is at least 50');
    expect(operatorBox()).toHaveTextContent('>=');
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Raw', '%']);
    expect(screen.getByRole('spinbutton', { name: 'Value' })).toHaveValue(50);
    await userEvent.click(operatorBox());
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['>', '<', '>=', '<=', '=', '≠']);
    for (const name of ['Greater than', 'Less than', 'Greater than or equal to', 'Less than or equal to', 'Equal to', 'Not equal to']) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('option', { name: 'Greater than or equal to' })).toHaveAttribute('aria-selected', 'true');
  });

  it('adds a stat under another owner with that owner in the sentence', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    fireEvent.click(await screen.findByRole('option', { name: /^Hunger/ }));
    expect(rows()[0].all[0]).toEqual({ kind: 'stat', id: 'hunger', owner: { kind: 'entity', id: 'ash', name: 'Ash' }, operator: '>=', value: 50, unit: 'raw' });
    expect(sentences()).toEqual(["Ash's Hunger is at least 50 and…"]);
  });

  it('updates the sentence as the operator and the value change', async () => {
    render(<Harness />);
    await addRage();
    openToken('Rage is at least 50');
    await pickOperator('Less than');
    expect(token('Rage is below 50')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '80' } });
    expect(token('Rage is below 80')).toBeInTheDocument();
    expect(rows()[0].all[0]).toMatchObject({ operator: '<', value: 80, unit: 'raw' });
  });

  it('keeps the value when the unit switches from raw to %', async () => {
    render(<Harness />);
    await addRage();
    openToken('Rage is at least 50');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Percent' }));
    expect(token('Rage is at least 80%')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Value' })).toHaveValue(80);
    fireEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(token('Rage is at least 80')).toBeInTheDocument();
  });

  it('keeps a typed minus sign and a cleared field as a draft, and commits only a number', async () => {
    render(<Harness />);
    await addRage();
    openToken('Rage is at least 50');
    const value = screen.getByRole('spinbutton', { name: 'Value' });
    fireEvent.change(value, { target: { value: '' } });
    expect(rows()[0].all[0]).toMatchObject({ value: 50 });
    fireEvent.change(value, { target: { value: '-5' } });
    expect(token('Rage is at least -5')).toBeInTheDocument();
    fireEvent.change(value, { target: { value: '' } });
    fireEvent.blur(value);
    expect(value).toHaveValue(-5);
  });

  it('flips to Not, and reads "Rage is not at least 80"', () => {
    render(<Harness initial={[{ all: [stat('>=', 80)] }]} />);
    openToken('Rage is at least 80');
    fireEvent.click(screen.getByRole('button', { name: 'Change to “is not”' }));
    expect(rows()[0].all[0]).toMatchObject({ id: 'rage', not: true });
    expect(token('Rage is not at least 80')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Rage is not at least 80', hidden: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change to “is”' }));
    expect(rows()[0].all[0]).not.toHaveProperty('not');
  });

  it('accepts "Rage < 80" after "Rage > 20", not refused as a duplicate', async () => {
    render(<Harness initial={[{ all: [stat('>', 20)] }]} />);
    fireEvent.click(screen.getByRole('button', { name: ADD_TO_ROW }));
    fireEvent.click(await screen.findByRole('option', { name: /^Rage/ }));
    expect(rows()[0].all).toHaveLength(2);
    openToken('Rage is at least 50');
    await pickOperator('Less than');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '80' } });
    expect(rows()[0].all.map((c) => c.kind === 'stat' && `${c.operator} ${c.value}`)).toEqual(['> 20', '< 80']);
  });

  it('refuses an edit that would repeat another Condition in the row', async () => {
    render(<Harness initial={[{ all: [stat('>', 20), { ...stat('<', 20) }] }]} />);
    openToken('Rage is below 20');
    await userEvent.click(operatorBox());
    expect(await screen.findByRole('option', { name: 'Greater than' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'Less than' })).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '30' } });
    expect(rows()[0].all[1]).toMatchObject({ operator: '<', value: 30 });
  });

  it('holds a number that would repeat another Condition as a draft, then puts the real one back on blur', () => {
    render(<Harness initial={[{ all: [stat('<', 80), stat('<', 20)] }]} />);
    openToken('Rage is below 20');
    const value = screen.getByRole('spinbutton', { name: 'Value' });
    fireEvent.change(value, { target: { value: '80' } });
    expect(rows()[0].all[1]).toMatchObject({ value: 20 });
    expect(value).toHaveValue(80);
    fireEvent.blur(value);
    expect(value).toHaveValue(20);
  });

  it('disables a unit that would repeat another Condition in the row', () => {
    const both = [{ all: [stat('>', 20, 'raw'), stat('>', 20, 'percent')] }];
    const { unmount } = render(<Harness initial={both} />);
    openToken('Rage is above 20');
    expect(screen.getByRole('radio', { name: 'Percent' })).toBeDisabled();
    unmount();
    render(<Harness initial={both} />);
    openToken('Rage is above 20%');
    expect(screen.getByRole('radio', { name: 'Raw' })).toBeDisabled();
  });

  it('disables a stat whose default Condition is already listed', async () => {
    render(<Harness initial={[{ all: [stat('>=', 50)] }]} />);
    fireEvent.click(screen.getByRole('button', { name: ADD_TO_ROW }));
    expect(await screen.findByRole('option', { name: /^Rage/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /^Gold/ })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('opens nothing from a stat Condition', () => {
    const onOpen = vi.fn();
    render(<Harness initial={[{ all: [stat('>=', 80)] }]} onOpen={onOpen} />);
    openToken('Rage is at least 80');
    expect(screen.queryByRole('button', { name: /^Open/ })).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('offers only the host’s own stats off-world, where nothing else exists', async () => {
    render(<Harness owner="ash" offWorld />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(await screen.findByText('Ash Stats')).toBeInTheDocument();
    expect(screen.queryByText('Global Stats')).not.toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Hunger', 'Time of Day']);
  });
});
