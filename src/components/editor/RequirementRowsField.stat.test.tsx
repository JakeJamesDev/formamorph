import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ADD_FIRST, ADD_TO_ROW, FieldHarness, sentences, writtenRows, type FieldInput } from '@/test/requirementRows';
import { requirementStatSections } from '@/lib/requirementStatOptions';
import type { GateStat, GateStatSet } from '@/lib/traitGates';
import { scoped, type OwnerId } from '@/lib/scope';
import type { StatRequirement, TraitRequirement, TraitRequirementRow } from '@/types';

const S = (name: string, extra: Partial<GateStat> = {}): GateStat => ({ name, value: 10, min: 0, max: 100, ...extra });
const ash = { id: 'ash', name: 'Ash' };
const input: FieldInput = {
  global: { traits: [], groups: [] },
  owners: [],
  entities: [ash],
  stats: scoped<GateStatSet>({ rage: S('Rage'), gold: S('Gold') }, { ash: { hunger: S('Hunger') } }),
};
// Rage is global and Ash's too; Mira has neither, so her stats never reach Rage's owner list.
const shared: FieldInput = {
  ...input,
  entities: [ash, { id: 'mira', name: 'Mira' }],
  stats: scoped<GateStatSet>({ rage: S('Rage'), gold: S('Gold') }, { ash: { hunger: S('Hunger'), rage: S('Rage') }, mira: { mood: S('Mood') } }),
};

/** The field over real stat sections and the real clauses, with edits that land. The host is the world, or `owner`. */
function Harness({ initial = [], owner = null, offWorld = false, onOpen = () => {}, world = input }: {
  initial?: TraitRequirementRow[];
  owner?: OwnerId;
  offWorld?: boolean;
  onOpen?: (r: TraitRequirement) => void;
  world?: FieldInput;
}) {
  return (
    <FieldHarness
      input={world} initial={initial} offWorld={offWorld} onOpen={onOpen} options={{ traits: [], groups: [], personas: [] }}
      statSections={requirementStatSections(world, owner)} host={owner === null ? { kind: 'world' } : { kind: 'entity', id: owner, name: 'Ash' }}
    />
  );
}

const rows = writtenRows;
const addRage = async (label: string = ADD_FIRST) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: /^Rage/ }));
};
/** A token by its spoken label; the rest of the page hides while a token's popover is open. */
const token = (label: string) => screen.getByRole('button', { name: label, hidden: true });
const openToken = (label: string) => fireEvent.click(token(label));
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);
const pickComparison = async (current: string, name: string) => {
  openToken(`Comparison: ${current}`);
  fireEvent.click(await screen.findByRole('option', { name }));
};
const valueBox = () => screen.getByRole('spinbutton', { name: 'Value' });
const stat = (operator: '>' | '<' | '>=', value: number, unit: 'raw' | 'percent' = 'raw'): StatRequirement => ({ kind: 'stat', id: 'rage', operator, value, unit });
const SIX = ['above', 'below', 'at least', 'at most', 'exactly', 'different from'];

// Q29: the picker's global section reads Global Stats.
describe('a stat Condition in the rows editor', () => {
  it('lists each owner’s stats and places a sentence whose tokens are the target, verb, comparison and value', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(screen.getByText('Global Stats')).toBeInTheDocument();
    expect(screen.getByText('Ash Stats')).toBeInTheDocument();
    expect(optionNames()).toEqual(['Rage', 'Gold', 'Hunger', 'Time of Day']);

    fireEvent.click(screen.getByRole('option', { name: /^Rage/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' }] }]);
    expect(sentences()).toEqual(['Rage is at least 50 and…']);
    for (const label of ['Target: Rage', 'Change to “is not”', 'Comparison: at least', 'Value: 50']) expect(token(label)).toBeInTheDocument();
  });

  it('reads a percent value as one token, "50%"', () => {
    render(<Harness initial={[{ all: [stat('>=', 50, 'percent')] }]} />);
    expect(sentences()).toEqual(['Rage is at least 50% and…']);
    expect(token('Value: 50%')).toBeInTheDocument();
  });

  it('adds a stat under another owner with that owner in the sentence', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    fireEvent.click(screen.getByRole('option', { name: /^Hunger/ }));
    expect(rows()[0].all[0]).toEqual({ kind: 'stat', id: 'hunger', owner: { kind: 'entity', id: 'ash', name: 'Ash' }, operator: '>=', value: 50, unit: 'raw' });
    expect(sentences()).toEqual(["Ash's Hunger is at least 50 and…"]);
  });

  it('writes the picked comparison, in each of the six words', async () => {
    render(<Harness />);
    await addRage();
    openToken('Comparison: at least');
    expect(optionNames()).toEqual(SIX);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    const operators = { above: '>', below: '<', 'at most': '<=', exactly: '=', 'different from': '≠', 'at least': '>=' } as const;
    let current = 'at least';
    for (const word of Object.keys(operators) as (keyof typeof operators)[]) {
      if (word === current) continue;
      await pickComparison(current, word);
      expect(rows()[0].all[0]).toMatchObject({ operator: operators[word], value: 50, unit: 'raw' });
      expect(token(`Comparison: ${word}`)).toBeInTheDocument();
      current = word;
    }
  });

  it('lists the same six comparison words in the same order after every selection', async () => {
    render(<Harness initial={[{ all: [stat('>', 20)] }]} />);
    let current = 'above';
    for (const word of SIX) {
      openToken(`Comparison: ${current}`);
      expect(optionNames()).toEqual(SIX);
      fireEvent.click(screen.getByRole('option', { name: word }));
      current = word;
    }
    openToken(`Comparison: ${current}`);
    expect(optionNames()).toEqual(SIX);
  });

  it('writes the number and the unit from the value token, and keeps the number when the unit switches', async () => {
    render(<Harness />);
    await addRage();
    openToken('Value: 50');
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Raw', '%']);
    fireEvent.change(valueBox(), { target: { value: '80' } });
    expect(token('Value: 80')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Percent' }));
    expect(token('Value: 80%')).toBeInTheDocument();
    expect(rows()[0].all[0]).toMatchObject({ value: 80, unit: 'percent' });
    expect(valueBox()).toHaveValue(80);
    fireEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(rows()[0].all[0]).toMatchObject({ value: 80, unit: 'raw' });
  });

  it('keeps a typed minus sign and a cleared field as a draft, and commits only a number', () => {
    render(<Harness initial={[{ all: [stat('>=', 50)] }]} />);
    openToken('Value: 50');
    const value = valueBox();
    fireEvent.change(value, { target: { value: '' } });
    expect(rows()[0].all[0]).toMatchObject({ value: 50 });
    fireEvent.change(value, { target: { value: '-5' } });
    expect(token('Value: -5')).toBeInTheDocument();
    fireEvent.change(value, { target: { value: '' } });
    fireEvent.blur(value);
    expect(value).toHaveValue(-5);
  });

  it('flips to Not on the verb, and reads "Rage is not at least 80"', () => {
    render(<Harness initial={[{ all: [stat('>=', 80)] }]} />);
    fireEvent.click(token('Change to “is not”'));
    expect(rows()[0].all[0]).toMatchObject({ id: 'rage', not: true, operator: '>=', value: 80 });
    expect(sentences()).toEqual(['Rage is not at least 80 and…']);
    expect(screen.getByRole('button', { name: 'Remove Rage is not at least 80' })).toBeInTheDocument();
    fireEvent.click(token('Change to “is”'));
    expect(rows()[0].all[0]).not.toHaveProperty('not');
  });

  it('accepts "Rage < 80" after "Rage > 20", not refused as a duplicate', async () => {
    render(<Harness initial={[{ all: [stat('>', 20)] }]} />);
    fireEvent.click(screen.getByRole('button', { name: ADD_TO_ROW }));
    fireEvent.click(await screen.findByRole('option', { name: /^Rage/ }));
    expect(rows()[0].all).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Comparison: at least' })[0]);
    fireEvent.click(await screen.findByRole('option', { name: 'below' }));
    fireEvent.click(token('Value: 50'));
    fireEvent.change(valueBox(), { target: { value: '80' } });
    expect(rows()[0].all.map((c) => c.kind === 'stat' && `${c.operator} ${c.value}`)).toEqual(['> 20', '< 80']);
  });

  it('disables a comparison, a Not flip and a unit that would repeat another Condition in the row', () => {
    render(<Harness initial={[{ all: [stat('>', 20), stat('<', 20), stat('<', 20, 'percent')] }]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Comparison: below' })[0]);
    expect(screen.getByRole('option', { name: 'above' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'at most' })).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Value: 20', hidden: true })[1]);
    expect(screen.getByRole('radio', { name: 'Percent' })).toBeDisabled();
  });

  it('holds a number that would repeat another Condition as a draft, then puts the real one back on blur', () => {
    render(<Harness initial={[{ all: [stat('<', 80), stat('<', 20)] }]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Value: 20' })[0]);
    const value = valueBox();
    fireEvent.change(value, { target: { value: '80' } });
    expect(rows()[0].all[1]).toMatchObject({ value: 20 });
    expect(value).toHaveValue(80);
    fireEvent.blur(value);
    expect(value).toHaveValue(20);
  });

  it('disables a stat whose default Condition is already listed', async () => {
    render(<Harness initial={[{ all: [stat('>=', 50)] }]} />);
    fireEvent.click(screen.getByRole('button', { name: ADD_TO_ROW }));
    expect(await screen.findByRole('option', { name: /^Rage/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /^Gold/ })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('opens the stat from its target token', () => {
    const onOpen = vi.fn();
    render(<Harness initial={[{ all: [stat('>=', 80)] }]} onOpen={onOpen} />);
    openToken('Target: Rage');
    fireEvent.click(screen.getByRole('button', { name: 'Open Rage' }));
    expect(onOpen).toHaveBeenCalledWith(stat('>=', 80));
  });

  it('offers only the host’s own stats off-world, where nothing else exists', () => {
    render(<Harness owner="ash" offWorld />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(screen.getByText('Ash Stats')).toBeInTheDocument();
    expect(screen.queryByText('Global Stats')).not.toBeInTheDocument();
    expect(optionNames()).toEqual(['Hunger', 'Time of Day']);
  });
});

describe('a stat Condition’s owner and target tokens', () => {
  const owned: StatRequirement = { ...stat('>=', 50), owner: { kind: 'entity', id: 'ash', name: 'Ash' } };

  it('lists only the owners that hold the stat, and changes the owner in place', () => {
    render(<Harness world={shared} initial={[{ all: [owned] }]} />);
    expect(sentences()).toEqual(["Ash's Rage is at least 50 and…"]);
    openToken('Owner: Ash');
    expect(optionNames()).toEqual(['No owner', 'Ash']);
    fireEvent.click(screen.getByRole('option', { name: 'No owner' }));
    expect(rows()[0].all[0]).toEqual(stat('>=', 50));
    expect(sentences()).toEqual(['Rage is at least 50 and…']);
  });

  it('swaps the target for a stat of the same owner, keeping the owner, comparison and Not', () => {
    const start: StatRequirement ={ ...owned, operator: '<', not: true, value: 80, unit: 'percent' };
    render(<Harness world={shared} initial={[{ all: [start] }]} />);
    openToken('Target: Rage');
    // Ash's stats only: Mira's and the global Gold never appear.
    expect(optionNames()).toEqual(['Hunger', 'Rage']);
    fireEvent.click(screen.getByRole('option', { name: 'Hunger' }));
    expect(rows()[0].all[0]).toMatchObject({ id: 'hunger', owner: owned.owner, operator: '<', not: true });
  });

  it('disables a swap that would repeat another Condition in the row', () => {
    const hunger: StatRequirement ={ kind: 'stat', id: 'hunger', owner: owned.owner, operator: '>=', value: 50, unit: 'raw' };
    render(<Harness world={shared} initial={[{ all: [owned, hunger] }]} />);
    openToken('Target: Rage');
    expect(screen.getByRole('option', { name: 'Hunger' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('gives a stat with no subject an Owner list in its target popover, and the sentence gains the subject', () => {
    render(<Harness world={shared} initial={[{ all: [stat('>=', 50)] }]} />);
    expect(screen.queryByRole('button', { name: /^Owner:/ })).toBeNull();
    openToken('Target: Rage');
    fireEvent.click(screen.getByRole('button', { name: 'Ash' }));
    expect(rows()[0].all[0]).toMatchObject({ id: 'rage', owner: owned.owner });
    expect(sentences()).toEqual(["Ash's Rage is at least 50 and…"]);
  });
});
