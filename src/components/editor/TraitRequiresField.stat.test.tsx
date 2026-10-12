import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/bearers';
import { startingGateStats } from '@/lib/gateStats';
import { TraitRequiresField } from './TraitRequiresField';
import type { Entity, Stat, Trait, TraitRequirementRow } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, starting: 10, regen: 0, descriptors: [], ...extra });

const berserk = trait('berserk', { name: 'Berserk' });
const squire = trait('squire', { name: 'Squire' });
const worldStats = [stat('rage', 'Rage', { starting: 90 })];
const mira: Entity = { id: 'mira', name: 'Mira', traits: [squire], stats: [stat('nerve', 'Nerve')] };

/** The field over a trait in the world, or in Mira's tree, with the editor's own gate input and stats. */
function Harness({ subject, offWorld = false }: { subject: Trait; offWorld?: boolean }) {
  const [current, setCurrent] = useState(subject);
  // The store reads the edited trait wherever it lives, as the World Editor's store does.
  const swap = (t: Trait) => (t.id === current.id ? current : t);
  const world = { traits: [berserk].map(swap), traitGroups: [], entities: [{ ...mira, traits: mira.traits!.map(swap) }] };
  const store = {
    ...world, placeholders: [], stats: worldStats,
    gateInput: editorGateInput(world, startingGateStats({ stats: worldStats, statGroups: [], entities: [mira] })),
    pinWorld: null, offWorld,
  } as unknown as TraitStore;
  return (
    <TooltipProvider>
      <TraitStoreContext.Provider value={store}>
        <TraitRequiresField
          trait={current}
          bearerId={subject.id === 'squire' ? 'mira' : undefined}
          onChange={(requires: TraitRequirementRow[]) => setCurrent({ ...current, requires: requires.length ? requires : undefined })}
          onOpen={() => {}}
        />
        <output data-testid="rows">{JSON.stringify(current.requires ?? [])}</output>
      </TraitStoreContext.Provider>
    </TooltipProvider>
  );
}

describe('TraitRequiresField with stats', () => {
  it('offers a world trait the player’s stats with no bearer, then each entity’s with its bearer', async () => {
    render(<Harness subject={berserk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(await screen.findByPlaceholderText('Search traits, groups, stats, and personas')).toBeInTheDocument();
    expect(screen.getByText('Player Stats')).toBeInTheDocument();
    expect(screen.getByText('Mira Stats')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /^Nerve/ }));
    expect(JSON.parse(screen.getByTestId('rows').textContent!)).toEqual([
      { all: [{ kind: 'stat', id: 'nerve', bearer: { kind: 'entity', id: 'mira', name: 'Mira' }, operator: '>=', value: 50, unit: 'raw' }] },
    ]);
    // The editor's gate input knows the stat, so its chip resolves under the entity's name.
    const chip = screen.getByRole('group', { name: 'Mira: Nerve >= 50' });
    expect(chip).not.toHaveAttribute('data-unresolved');
  });

  it('offers an entity’s trait its own stats with no bearer, and the player’s as You', async () => {
    render(<Harness subject={squire} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(await screen.findByText('Mira Stats')).toBeInTheDocument();
    expect(screen.getByText('Player Stats')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /^Nerve/ }));
    fireEvent.click(screen.getByRole('button', { name: 'And' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Rage/ }));
    expect(JSON.parse(screen.getByTestId('rows').textContent!)[0].all.map((c: { id: string; bearer?: unknown }) => [c.id, c.bearer ?? null]))
      .toEqual([['nerve', null], ['rage', { kind: 'you' }]]);
    expect(screen.getByRole('group', { name: 'Nerve >= 50' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'You: Rage >= 50' })).toBeInTheDocument();
  });

  it('offers an off-world entity only its own stats', async () => {
    render(<Harness subject={squire} offWorld />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(await screen.findByPlaceholderText('Search traits, groups, and stats')).toBeInTheDocument();
    expect(screen.getByText('Mira Stats')).toBeInTheDocument();
    expect(screen.queryByText('Player Stats')).not.toBeInTheDocument();
  });
});
