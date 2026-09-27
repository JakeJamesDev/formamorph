import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TraitDropRefusalNotice } from './TraitTree';

describe('TraitDropRefusalNotice', () => {
  it('names a refused trait and asks for its stat effects to go first', () => {
    render(<TraitDropRefusalNotice refusal={{ name: 'Plate Armor', kind: 'trait', offender: 'Plate Armor', owner: null }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Plate Armor stays a world trait, because an entity's traits can't change stats. Remove its stat changes and stat toggles first.",
    );
  });

  it('names a refused group and the trait inside it that has stat effects', () => {
    render(<TraitDropRefusalNotice refusal={{ name: 'Class', kind: 'group', offender: 'Plate Armor', owner: null }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Class stays a world group, because an entity's traits can't change stats. Remove the stat changes and stat toggles from Plate Armor first.",
    );
  });

  it('names the entity a refused trait stays with', () => {
    render(<TraitDropRefusalNotice refusal={{ name: 'Gruff', kind: 'trait', offender: 'Gruff', owner: 'Bob' }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Gruff stays Bob's trait, because an entity's traits can't change stats. Remove its stat changes and stat toggles first.",
    );
  });

  it('dismisses', () => {
    const onDismiss = vi.fn();
    render(<TraitDropRefusalNotice refusal={{ name: 'Class', kind: 'group', offender: 'Plate Armor', owner: null }} placeholders={[]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
