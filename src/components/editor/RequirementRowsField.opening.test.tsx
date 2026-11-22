import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from './RequirementRowsField';
import { conditionTexts, requirementOptions, ruleStates, NO_ACTIVE, type GateInput } from '@/lib/traitGates';
import { openingPickGroups } from '@/lib/testBench/openingPick';
import type { Entity, GameLocation, TraitRequirementRow, WorldOverview } from '@/types';

const aki = { id: 'aki', name: 'Aki', openings: [{ id: 'a1', text: 'Hi.', kind: 'action' }, { id: 'a2', text: 'Run!', kind: 'action', name: 'chase' }] } as Entity;
const dock = { id: 'dock', name: 'Dock', openings: [{ id: 'd1', text: 'Fog.', kind: 'narration' }] } as GameLocation;
const worldOverview = { openings: [{ id: 'w1', text: 'Dawn.', kind: 'action', name: 'ambush' }] } as WorldOverview;
const groups = openingPickGroups({ traits: [], traitGroups: [], entities: [aki], locations: [dock], placeholders: [], stats: [], worldOverview });

const base: GateInput = { global: { traits: [], groups: [] }, owners: [], active: NO_ACTIVE, entities: [], persona: { source: 'none' } };

/** The field over the real rule text, the real options and the real row states, with edits that land. */
function Harness({ initial = [], withOpenings = true, openings = groups }: { initial?: TraitRequirementRow[]; withOpenings?: boolean; openings?: typeof groups }) {
  const input: GateInput = { ...base, ...(withOpenings && { openings }) };
  const [rows, setRows] = useState(initial);
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} states={ruleStates(input, null, rows)} placeholders={[]} options={requirementOptions(input, 'a')}
        textOf={conditionTexts(input)} onChange={setRows} onOpen={() => {}}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

const rows = (): TraitRequirementRow[] => JSON.parse(screen.getByTestId('rows').textContent!);
const WORLD = { ownerId: null, openingId: 'w1' };
const openList = () => fireEvent.click(screen.getByRole('button', { name: /^Openings:/ }));

describe('an Opening Condition in the rows editor', () => {
  it('is offered only while the world has an Opening', async () => {
    const { unmount } = render(<Harness withOpenings={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(screen.queryByRole('option', { name: /^Opening/ })).toBeNull();
    unmount();
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(await screen.findByRole('option', { name: /^Opening/ })).toBeInTheDocument();
  });

  it('adds an empty, red chip with no owner page', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Opening/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'opening', openings: [] }] }]);
    expect(screen.getByRole('group', { name: 'no Opening' })).toHaveAttribute('data-unresolved', 'true');
  });

  it('groups every Opening by owner, World first, with derived labels for unnamed rows', async () => {
    render(<Harness initial={[{ all: [{ kind: 'opening', openings: [WORLD] }] }]} />);
    openList();
    await screen.findByRole('option', { name: 'ambush' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Select All', 'ambush', 'Aki · Opening 1', 'chase', 'Dock · Opening 1']);
    const headings = screen.getAllByText(/^(World|Aki|Dock)$/).map((h) => h.textContent);
    expect(headings).toEqual(['World', 'Aki', 'Dock']);
  });

  it('picks several Openings, and unchecking the last leaves the chip red until one is checked again', async () => {
    render(<Harness initial={[{ all: [{ kind: 'opening', openings: [WORLD] }] }]} />);
    openList();
    fireEvent.click(await screen.findByRole('option', { name: 'ambush' }));
    expect(rows()).toEqual([{ all: [{ kind: 'opening', openings: [] }] }]);
    expect(screen.getByRole('group', { name: 'no Opening', hidden: true })).toHaveAttribute('data-unresolved', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'ambush' }));
    fireEvent.click(screen.getByRole('option', { name: 'Dock · Opening 1' }));
    expect(rows()).toEqual([{ all: [{ kind: 'opening', openings: [WORLD, { ownerId: null, openingId: 'd1', locationId: 'dock' }] }] }]);
    // The modal list hides the rest of the page while it is open.
    expect(screen.getByRole('button', { name: 'Openings: ambush or Dock · Opening 1', hidden: true })).toBeInTheDocument();
  });

  it('flips to Not and back, keeping its Openings', () => {
    render(<Harness initial={[{ all: [{ kind: 'opening', openings: [WORLD] }] }]} />);
    fireEvent.click(screen.getByRole('button', { name: /to be off$/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'opening', openings: [WORLD], not: true }] }]);
    expect(screen.getByText('NOT')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /instead$/ }));
    expect(rows()[0].all[0]).not.toHaveProperty('not');
  });

  it('shows a deleted Opening as unresolved, and the next edit drops its key', async () => {
    const dead = { ownerId: 'aki', openingId: 'gone' };
    render(<Harness initial={[{ all: [{ kind: 'opening', openings: [WORLD, dead] }] }]} />);
    expect(screen.getByRole('group', { name: 'Opening ambush or a missing Opening' })).toHaveAttribute('data-unresolved', 'true');
    openList();
    fireEvent.click(await screen.findByRole('option', { name: 'chase' }));
    expect(rows()).toEqual([{ all: [{ kind: 'opening', openings: [WORLD, { ownerId: 'aki', openingId: 'a2' }] }] }]);
    expect(screen.getByRole('group', { name: 'Opening ambush or chase', hidden: true })).not.toHaveAttribute('data-unresolved');
  });

  it('selects every Opening from the Select All row at the top of the list', async () => {
    render(<Harness initial={[{ all: [{ kind: 'opening', openings: [WORLD] }] }]} />);
    openList();
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options[0]).toBe('Select All');
    fireEvent.click(screen.getByRole('option', { name: 'Select All' }));
    expect(rows()[0].all[0]).toMatchObject({ openings: groups.flatMap((g) => g.options.map((o) => o.key)) });
    fireEvent.click(screen.getByRole('option', { name: 'Select All' }));
    expect(rows()[0].all[0]).toMatchObject({ openings: [] });
  });
});

describe('an Opening Condition in a world with many Openings', () => {
  const many = { id: 'many', name: 'Mara', openings: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, text: '.', kind: 'action' })) } as Entity;
  const big = openingPickGroups({ traits: [], traitGroups: [], entities: [aki, many], locations: [dock], placeholders: [], stats: [], worldOverview });

  it('opens on the owners past eight Openings, each with its picked count', async () => {
    render(<Harness openings={big} initial={[{ all: [{ kind: 'opening', openings: [WORLD] }] }]} />);
    openList();
    await screen.findByRole('option', { name: 'Select All' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Select All', 'World1 of 1', 'Aki2', 'Mara6', 'Dock1']);
  });

  it('opens an owner on its own Openings, selects them all, and steps back', async () => {
    render(<Harness openings={big} initial={[{ all: [{ kind: 'opening', openings: [WORLD] }] }]} />);
    openList();
    fireEvent.click(await screen.findByRole('option', { name: /^Mara/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Select All', ...many.openings!.map((_, i) => `Mara · Opening ${i + 1}`)]);
    fireEvent.click(screen.getByRole('option', { name: 'Select All' }));
    expect(rows()[0].all[0]).toMatchObject({ openings: [WORLD, ...many.openings!.map((o) => ({ ownerId: 'many', openingId: o.id }))] });
    fireEvent.click(screen.getByRole('option', { name: 'Select All' }));
    expect(rows()[0].all[0]).toMatchObject({ openings: [WORLD] });
    fireEvent.click(screen.getByRole('option', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mara' }));
    expect(screen.getByRole('option', { name: /^Mara/ })).toHaveTextContent('Mara6 of 6');
  });
});
