import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ADD_FIRST, FieldHarness, sentences, writtenRows, type FieldInput } from '@/test/requirementRows';
import type { GateStat, GateStatSet } from '@/lib/traitGates';
import { scoped } from '@/lib/scope';
import type { StatRequirement } from '@/types';

const S = (name: string): GateStat => ({ name, value: 10, min: 0, max: 100 });
const mira = { id: 'mira', name: 'Mira' };
const world: FieldInput = {
  global: { traits: [], groups: [] },
  owners: [],
  entities: [mira],
  stats: scoped<GateStatSet>({ gold: S('Gold') }, { mira: { courage: S('Courage') } }),
  blueprintStats: { courage: S('Courage'), lonely: S('Lonely') },
};
const courage: StatRequirement = { kind: 'stat', id: 'courage', operator: '>=', value: 50, unit: 'raw' };
const named: StatRequirement = { ...courage, owner: { kind: 'entity', id: 'mira', name: 'Mira' } };

function Harness({ initial }: { initial: StatRequirement[] }) {
  return (
    <FieldHarness
      input={world} initial={initial.length ? [{ all: initial }] : []} options={{ personas: [] }} host={{ kind: 'blueprint' }}
    />
  );
}
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('a Blueprint stat on a Blueprint’s own field', () => {
  it('adds a no-owner Condition from the Blueprints page, read as "This entity"', () => {
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(screen.getByText('Blueprint Stats')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('option', { name: /^Courage/ })[0]);
    expect(writtenRows()[0].all[0]).toEqual(courage);
    expect(sentences()).toEqual(["This entity's Courage is at least 50 and…"]);
  });

  it('offers the no-owner choice beside the entities that link the stat, and a pick removes the owner', () => {
    render(<Harness initial={[named]} />);
    expect(sentences()).toEqual(["Mira's Courage is at least 50 and…"]);
    fireEvent.click(screen.getByRole('button', { name: 'Owner: Mira', hidden: true }));
    expect(optionNames()).toEqual(['This entity', 'Mira']);
    fireEvent.click(screen.getByRole('option', { name: 'This entity' }));
    expect(writtenRows()[0].all[0]).toEqual(courage);
    expect(sentences()).toEqual(["This entity's Courage is at least 50 and…"]);
  });

  it('marks a stat no entity links when the Condition names an owner, and says why', () => {
    render(<Harness initial={[{ ...named, id: 'lonely' }]} />);
    const target = screen.getByRole('button', { name: 'Target: Lonely', hidden: true });
    expect(target).toHaveAttribute('data-broken');
    expect(target).toHaveAttribute('aria-description', 'No entity has this stat.');
  });

  it('shows no broken token for a no-owner Blueprint stat', () => {
    render(<Harness initial={[courage]} />);
    expect(document.querySelector('[data-broken]')).toBeNull();
  });
});
