import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TraitDropRefusalNotice } from './TraitTree';

describe('TraitDropRefusalNotice', () => {
  it('names the entity that already has a trait a refused link points at', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'duplicate', name: 'Paladin', bearer: 'Albus' }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Albus already has Paladin.');
  });

  it('names the one entity that keeps a linked Blueprint in Blueprints', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'blueprint-linked', name: 'Paladin', bearers: ['Albus'] }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Paladin stays in Blueprints, because Albus links to it or to something in it. Remove those links first.',
    );
  });

  it('lists every entity that keeps a linked Blueprint in Blueprints', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'blueprint-linked', name: 'Classes', bearers: ['Albus', 'Bo', 'Cy'] }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Classes stays in Blueprints, because Albus, Bo and Cy link to it or to something in it. Remove those links first.',
    );
  });

  it('names a refused trait and asks for its stat effects to go first', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'stats', name: 'Plate Armor', kind: 'trait', offender: 'Plate Armor', owner: null }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Plate Armor stays a world trait, because only a persona's traits can change stats. Remove its stat changes and stat toggles first.",
    );
  });

  it('names a refused group and the trait inside it that has stat effects', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'stats', name: 'Class', kind: 'group', offender: 'Plate Armor', owner: null }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Class stays a world group, because only a persona's traits can change stats. Remove the stat changes and stat toggles from Plate Armor first.",
    );
  });

  it('names the entity a refused trait stays with', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'stats', name: 'Gruff', kind: 'trait', offender: 'Gruff', owner: 'Bob' }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Gruff stays Bob's trait, because only a persona's traits can change stats. Remove its stat changes and stat toggles first.",
    );
  });

  it('dismisses', () => {
    const onDismiss = vi.fn();
    render(<TraitDropRefusalNotice refusal={{ reason: 'stats', name: 'Class', kind: 'group', offender: 'Plate Armor', owner: null }} placeholders={[]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
