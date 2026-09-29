import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SetupTraitList } from './SetupTraitList';
import { groupPickState } from '@/lib/traitGates';
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
  id: 'origin', name: 'Origin', parentId: null, maxPicks: 1, playerDescription: 'Where you grew up.',
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
      picks={groupPickState(origin, [dockhand, scholar], props.selectedTraits ?? [])}
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

  it('offers a max-one group as one choice at most', () => {
    const onTraitSelect = view({ selectedTraits: ['dockhand'] });
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Dockhand' })).toBeChecked();
    // Clicking the chosen one clears it, so "none of these" stays reachable.
    fireEvent.click(screen.getByRole('radio', { name: 'Dockhand' }));
    expect(onTraitSelect).toHaveBeenCalledWith('dockhand', 'world');
  });

  it('offers a group with no max as checkboxes', () => {
    const onTraitSelect = view({ picks: null });
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Scholar' }));
    expect(onTraitSelect).toHaveBeenCalledWith('scholar', 'world');
  });

  it('disables the unchecked rows of a full group with a larger max, and keeps the checked ones switchable', () => {
    const skills = { ...origin, maxPicks: 2 };
    const sailor = { ...scholar, id: 'sailor', name: 'Sailor' };
    const traits = [dockhand, scholar, sailor];
    const selectedTraits = ['dockhand', 'scholar'];
    view({ traits, selectedTraits, picks: groupPickState(skills, traits, selectedTraits) });
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Sailor' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Dockhand' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Scholar' })).toBeEnabled();
  });

  describe('a group with a minimum', () => {
    const skills = { ...origin, minPicks: 2, maxPicks: undefined };
    const shortBy = (selectedTraits: string[]) =>
      view({ selectedTraits, picks: groupPickState(skills, [dockhand, scholar], selectedTraits) });

    it('says how many more picks it needs', () => {
      shortBy([]);
      expect(screen.getByText('Choose 2 more traits')).toBeInTheDocument();
    });

    it('names one more trait in the singular', () => {
      shortBy(['dockhand']);
      expect(screen.getByText('Choose 1 more trait')).toBeInTheDocument();
    });

    it('says nothing once the minimum is met', () => {
      shortBy(['dockhand', 'scholar']);
      expect(screen.queryByText(/more trait/)).toBeNull();
    });
  });

  it('keeps every row open below a larger max', () => {
    const skills = { ...origin, maxPicks: 2 };
    view({ selectedTraits: ['dockhand'], picks: groupPickState(skills, [dockhand, scholar], ['dockhand']) });
    expect(screen.getByRole('checkbox', { name: 'Scholar' })).toBeEnabled();
  });
});

describe('SetupTraitList gates', () => {
  const req = (text: string, holds: boolean, hidden = false) => ({ text, holds, unresolved: false, hidden });
  const gates = new Map([['world', new Map([
    ['dockhand', { unlocked: false, requirements: [req('Paladin', false), req('Knight', false)] }],
    ['scholar', { unlocked: true, requirements: [req('Mage', true), req('any Class', false)] }],
  ])]]);

  it('keeps a locked trait in place, disabled, and says what it requires', () => {
    view({ gates, picks: null });
    expect(screen.getByRole('checkbox', { name: 'Dockhand' })).toBeDisabled();
    expect(screen.getByText('Requires Paladin or Knight')).toBeInTheDocument();
  });

  it('disables a locked radio in a max-one group', () => {
    view({ gates });
    expect(screen.getByRole('radio', { name: 'Dockhand' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Scholar' })).toBeEnabled();
  });

  it('names only the requirements that unlocked an open gated trait', () => {
    view({ gates, picks: null });
    expect(screen.getByRole('checkbox', { name: 'Scholar' })).toBeEnabled();
    expect(screen.getByText('Unlocked by Mage')).toBeInTheDocument();
  });

  it('shows a dismissible banner naming what a change turned off and why', () => {
    const onDismissCascade = vi.fn();
    view({ cascade: { off: ['Plate Armor', 'Shield'], because: 'Rogue' }, onDismissCascade });
    expect(screen.getByRole('status')).toHaveTextContent('Turned off Plate Armor and Shield, because of Rogue.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissCascade).toHaveBeenCalled();
  });

  it('shows no banner when nothing turned off', () => {
    view();
    expect(screen.queryByRole('status')).toBeNull();
  });

  describe('an Always On trait', () => {
    const marked: Trait = { id: 'marked', name: 'Marked', groupId: 'origin', mode: 'alwaysOn', statChanges: [] } as Trait;
    const traits = [dockhand, scholar, marked];

    it('does not show while dormant', () => {
      view({ traits, picks: groupPickState(origin, traits, []) });
      expect(screen.queryByText('Marked')).toBeNull();
      expect(screen.getByRole('radio', { name: 'Scholar' })).toBeEnabled();
    });

    it('shows checked with no control while active, and blocks the max-one group’s other picks', () => {
      view({ traits, selectedTraits: ['marked'], picks: groupPickState(origin, traits, ['marked']) });
      expect(screen.getByText('Marked')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Always On' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Marked' })).toBeNull();
      expect(screen.getByRole('radio', { name: 'Scholar' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Dockhand' })).toBeDisabled();
    });

    it('shows no control in a checkbox group either', () => {
      view({ traits: [marked], picks: null, selectedTraits: ['marked'] });
      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(screen.getByRole('img', { name: 'Always On' })).toBeInTheDocument();
    });
  });

  describe('a Hidden trait', () => {
    const secret: Trait = { id: 'secret-bond', name: 'Secret Bond', groupId: 'origin', mode: 'hidden', statChanges: [] } as Trait;
    const traits = [dockhand, scholar, secret];

    it('does not show while active, and still blocks the max-one group’s other picks', () => {
      view({ traits, selectedTraits: ['secret-bond'], picks: groupPickState(origin, traits, ['secret-bond']) });
      expect(screen.queryByText('Secret Bond')).toBeNull();
      expect(screen.queryByRole('img', { name: 'Always On' })).toBeNull();
      expect(screen.getByRole('radio', { name: 'Scholar' })).toBeDisabled();
    });

    it('leaves a Hidden requirement out of the gate line', () => {
      const hiddenGates = new Map([['world', new Map([
        ['dockhand', { unlocked: false, requirements: [req('Secret Bond', false, true), req('Knight', false)] }],
        ['scholar', { unlocked: true, requirements: [req('Secret Bond', true, true), req('Mage', true)] }],
      ])]]);
      view({ gates: hiddenGates, picks: null });
      expect(screen.getByText('Requires Knight')).toBeInTheDocument();
      expect(screen.getByText('Unlocked by Mage')).toBeInTheDocument();
      expect(screen.queryByText(/Secret Bond/)).toBeNull();
    });

    it('reads a bare "Locked" when every requirement is Hidden', () => {
      const hiddenGates = new Map([['world', new Map([
        ['dockhand', { unlocked: false, requirements: [req('Secret Bond', false, true)] }],
      ])]]);
      view({ gates: hiddenGates, picks: null });
      expect(screen.getByText('Locked')).toBeInTheDocument();
      expect(screen.queryByText(/Secret Bond/)).toBeNull();
    });
  });
});
