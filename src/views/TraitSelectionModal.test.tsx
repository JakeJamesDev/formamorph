import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TraitSelectionModal from './TraitSelectionModal';
import type { Trait, TraitGroup } from '@/types';

const groups: TraitGroup[] = [
  { id: 'world', name: 'World', parentId: null, order: 0 },
  { id: 'player', name: 'Player', parentId: null, order: 1 },
];
const traits: Trait[] = [
  { id: 'loner', name: 'Loner', statChanges: [], groupId: null, order: 0 },
  { id: 'storm', name: 'Stormtouched', statChanges: [], groupId: 'world', order: 0 },
  { id: 'quick', name: 'Quick', statChanges: [], groupId: 'player', isDefault: true, order: 0 },
];

function Harness({ onConfirm = () => {}, onAbort = () => {} }: { onConfirm?: () => void; onAbort?: () => void }) {
  // Seed defaults the way MainMenu does.
  const [selected, setSelected] = useState<string[]>(traits.filter((t) => t.isDefault).map((t) => t.id));
  return (
    <TraitSelectionModal
      traits={traits}
      traitGroups={groups}
      stats={[]}
      selectedTraits={selected}
      onTraitSelect={(id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
      onConfirm={onConfirm}
      onAbort={onAbort}
    />
  );
}

describe('TraitSelectionModal', () => {
  it('shows General + group tabs and switches sections', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Loner')).toBeInTheDocument(); // ungrouped under General
    await user.click(screen.getByRole('tab', { name: 'World' }));
    expect(screen.getByText('Stormtouched')).toBeInTheDocument();
  });

  it('pre-checks Enabled-by-Default traits', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Player' }));
    expect(screen.getByRole('checkbox')).toBeChecked(); // Quick is the only trait here, default on
  });

  it('Next walks the sections and the final button starts the game', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next')); // General -> World
    fireEvent.click(screen.getByText('Next')); // World -> Player (last)
    fireEvent.click(screen.getByText('Start'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('hides the General tab when there are no ungrouped traits', () => {
    const grouped = traits.filter((t) => t.groupId); // storm (World), quick (Player)
    render(
      <TraitSelectionModal
        traits={grouped}
        traitGroups={groups}
        stats={[]}
        selectedTraits={[]}
        onTraitSelect={() => {}}
        onConfirm={() => {}}
        onAbort={() => {}}
      />,
    );
    expect(screen.queryByRole('tab', { name: 'General' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'World' })).toBeInTheDocument();
    expect(screen.getByText('Stormtouched')).toBeInTheDocument(); // first section is the first group
  });

  it('hides groups whose subtree has no traits', () => {
    const withEmpty: TraitGroup[] = [...groups, { id: 'empty', name: 'Empty', parentId: null, order: 2 }];
    render(
      <TraitSelectionModal
        traits={traits}
        traitGroups={withEmpty}
        stats={[]}
        selectedTraits={[]}
        onTraitSelect={() => {}}
        onConfirm={() => {}}
        onAbort={() => {}}
      />,
    );
    expect(screen.queryByRole('tab', { name: 'Empty' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'World' })).toBeInTheDocument();
  });

  it('auto-drills to the first nested group when a container is selected', async () => {
    const user = userEvent.setup();
    const nested: TraitGroup[] = [
      { id: 'world', name: 'World', parentId: null, order: 0 }, // container (no direct traits)
      { id: 'clans', name: 'Clans', parentId: 'world', order: 0 }, // leaf with a trait
    ];
    const nestedTraits: Trait[] = [
      { id: 'storm', name: 'Stormtouched', statChanges: [], groupId: 'clans', order: 0 },
    ];
    render(
      <TraitSelectionModal
        traits={nestedTraits}
        traitGroups={nested}
        stats={[]}
        selectedTraits={[]}
        onTraitSelect={() => {}}
        onConfirm={() => {}}
        onAbort={() => {}}
      />,
    );
    // On open it drills World -> Clans, so the nested trait is already visible.
    expect(screen.getByRole('tab', { name: 'World' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Clans' })).toBeInTheDocument();
    expect(screen.getByText('Stormtouched')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'World' })); // still resolves to Clans
    expect(screen.getByText('Stormtouched')).toBeInTheDocument();
  });

  it('gives a mixed group (own traits + subgroup) a default-selected General tab', async () => {
    const user = userEvent.setup();
    const mixed: TraitGroup[] = [
      { id: 'world', name: 'World', parentId: null, order: 0 },
      { id: 'clans', name: 'Clans', parentId: 'world', order: 0 },
    ];
    const mixedTraits: Trait[] = [
      { id: 'wt', name: 'WorldTrait', statChanges: [], groupId: 'world', order: 0 },
      { id: 'ct', name: 'ClanTrait', statChanges: [], groupId: 'clans', order: 0 },
    ];
    render(
      <TraitSelectionModal
        traits={mixedTraits}
        traitGroups={mixed}
        stats={[]}
        selectedTraits={[]}
        onTraitSelect={() => {}}
        onConfirm={() => {}}
        onAbort={() => {}}
      />,
    );
    // World has its own trait + a subgroup → child row shows a General tab, selected by default.
    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Clans' })).toBeInTheDocument();
    expect(screen.getByText('WorldTrait')).toBeInTheDocument(); // General (World's own) shown first
    await user.click(screen.getByRole('tab', { name: 'Clans' }));
    expect(screen.getByText('ClanTrait')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'General' }));
    expect(screen.getByText('WorldTrait')).toBeInTheDocument();
  });

  it('Skip confirms and Abort aborts', () => {
    const onConfirm = vi.fn();
    const onAbort = vi.fn();
    render(<Harness onConfirm={onConfirm} onAbort={onAbort} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Abort'));
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});
