import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SetupTraitList } from './SetupTraitList';
import type { Stat, Trait, TraitGroup } from '@/types';

/**
 * The setup screen's trait list renders from the world's traits alone. In Play shows it inside the World
 * Editor, outside the full-screen setup dialog and with no game running.
 */

const stats: Stat[] = [
  { id: 'grit', name: 'Grit', min: 0, max: 10, value: 5 } as Stat,
  { id: 'secret', name: 'Secret', min: 0, max: 10, value: 0, hidden: true } as Stat,
];
const origin: TraitGroup = {
  id: 'origin', name: 'Origin', parentId: null, exclusive: true, playerDescription: 'Where you grew up.',
};
const dockhand: Trait = {
  id: 'dockhand', name: 'Dockhand', groupId: 'origin', playerDescription: 'You hauled nets for years.',
  statChanges: [
    { statId: 'grit', value: 2, type: 'starting' },
    { statId: 'grit', value: -1, type: 'max' },
    { statId: 'secret', value: 3, type: 'starting' },
  ],
} as Trait;
const scholar: Trait = { id: 'scholar', name: 'Scholar', groupId: 'origin', statChanges: [] } as Trait;

const identity = (text: string) => text;
const traitIdentity = (_trait: Trait, text: string) => text;

const view = (props: Partial<Parameters<typeof SetupTraitList>[0]> = {}) => {
  const onTraitSelect = vi.fn();
  render(
    <SetupTraitList
      name="Origin"
      groups={[origin]}
      traits={[dockhand, scholar]}
      exclusive
      stats={stats}
      selectedTraits={[]}
      resolveText={identity}
      resolveTraitText={traitIdentity}
      onTraitSelect={onTraitSelect}
      {...props}
    />,
  );
  return onTraitSelect;
};

afterEach(cleanup);

describe('SetupTraitList outside the setup dialog', () => {
  it('shows the group, its traits, their Player-Facing Descriptions and their shown stat changes', () => {
    view();
    expect(screen.getByRole('heading', { name: 'Origin' })).toBeInTheDocument();
    expect(screen.getByText('Where you grew up.')).toBeInTheDocument();
    expect(screen.getByText('Dockhand')).toBeInTheDocument();
    expect(screen.getByText('You hauled nets for years.')).toBeInTheDocument();
    // A hidden stat's change still applies; the list just never names it.
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Grit: +2', 'Grit: -1 (max)']);
  });

  it('offers an exclusive group as one choice at most', () => {
    const onTraitSelect = view({ selectedTraits: ['dockhand'] });
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Dockhand' })).toBeChecked();
    // Clicking the chosen one clears it, so "none of these" stays reachable.
    fireEvent.click(screen.getByRole('radio', { name: 'Dockhand' }));
    expect(onTraitSelect).toHaveBeenCalledWith('dockhand');
  });

  it('offers a non-exclusive group as checkboxes', () => {
    const onTraitSelect = view({ exclusive: false });
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Scholar' }));
    expect(onTraitSelect).toHaveBeenCalledWith('scholar');
  });
});
