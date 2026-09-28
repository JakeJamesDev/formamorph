import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { LinkedFromLine, ThisLinkSection } from './TraitLinkPanel';
import { phValues } from '@/test/placeholderValues';
import type { Entity, Placeholder, Trait, TraitGroup, TraitLink } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const traits = [
  trait('paladin', {
    name: 'Paladin', groupId: 'classes', order: 0, isDefault: true,
    placeholderPins: [{ placeholderId: 'garb', value: 'Tabard' }],
  }),
  trait('wizard', { name: 'Wizard', groupId: 'classes', order: 1, statChanges: [{ statId: 's', value: 1, type: 'min' }] }),
  trait('brave', { name: 'Brave', groupId: null, order: 1 }),
];
const traitGroups: TraitGroup[] = [
  { id: 'templates', name: 'Templates', parentId: null, order: 0, system: 'templates' },
  { id: 'classes', name: 'Classes', parentId: 'templates', order: 0 },
];
const link = (originalId: string, kind: TraitLink['kind']): TraitLink =>
  ({ id: 'l1', originalId, kind, originalName: originalId, groupId: null, order: 0 });

const worldGarb: Placeholder = { id: 'garb', name: 'Class Garb', values: phValues(['Robe', 'Plate']) };

/** A store over one entity whose edits land, so a test reads what the author would see next. */
function Harness({ entity, children }: { entity: Entity; children: (e: Entity) => ReactNode }) {
  const [current, setCurrent] = useState(entity);
  const own = current.placeholders ?? [];
  const store = {
    traits, traitGroups, entities: [current], placeholders: [worldGarb, ...own], stats: [],
    placeholderOwners: new Map(own.map((p) => [p.id, { kind: 'entity', id: current.id, name: current.name }])),
    editEntity: (_id: string, edit: (e: Entity) => Entity) => setCurrent(edit),
  } as unknown as TraitStore;
  return <TraitStoreContext.Provider value={store}>{children(current)}</TraitStoreContext.Provider>;
}

const renderSection = (entity: Entity, originalId: string) =>
  render(<Harness entity={entity}>{(e) => <ThisLinkSection entity={e} link={e.traitLinks![0]} originalId={originalId} />}</Harness>);

describe('LinkedFromLine', () => {
  it('names where the original lives and opens it', () => {
    const onOpen = vi.fn();
    render(<Harness entity={{ id: 'ash', name: 'Ash' }}>{() => <LinkedFromLine originalId="paladin" onOpen={onOpen} />}</Harness>);
    expect(screen.getByText(/Linked from/).textContent).toBe('Linked from Templates › Classes › Paladin. Edits change every link.');
    fireEvent.click(screen.getByRole('button', { name: 'Templates › Classes › Paladin' }));
    expect(onOpen).toHaveBeenCalledWith('paladin');
  });
});

describe('ThisLinkSection', () => {
  it("reads the original's default until the author sets the link's own", () => {
    renderSection({ id: 'ash', name: 'Ash', traitLinks: [link('paladin', 'trait')] }, 'paladin');
    const box = screen.getByRole('checkbox', { name: /Enabled by Default/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(screen.getByRole('checkbox', { name: /Enabled by Default/ })).not.toBeChecked();
  });

  it('lists each trait of a linked group with its own default', () => {
    renderSection({ id: 'ash', name: 'Ash', traitLinks: [link('classes', 'group')] }, 'classes');
    const list = screen.getByRole('list', { name: 'Enabled by Default' });
    expect(within(list).getByRole('checkbox', { name: 'Paladin' })).toBeChecked();
    fireEvent.click(within(list).getByRole('checkbox', { name: 'Wizard' }));
    expect(within(list).getByRole('checkbox', { name: 'Wizard' })).toBeChecked();
  });

  it('notes that stat changes wait for play as a playable entity', () => {
    renderSection({ id: 'ash', name: 'Ash', persona: true, traitLinks: [link('wizard', 'trait')] }, 'wizard');
    expect(screen.getByText('Stat changes apply only when you play as them')).toBeInTheDocument();
  });

  it('notes that stat changes never apply to an entity nobody can play as', () => {
    renderSection({ id: 'ash', name: 'Ash', traitLinks: [link('wizard', 'trait')] }, 'wizard');
    expect(screen.getByText("Stat changes don't apply to entities")).toBeInTheDocument();
  });

  it("has no stat note on the Custom Persona entity, whose links are the player's", () => {
    renderSection({ id: 'you', name: 'Wanderer', customPersona: true, traitLinks: [link('wizard', 'trait')] }, 'wizard');
    expect(screen.queryByText(/Stat changes/)).toBeNull();
    expect(screen.getByText('Selected when a new game starts')).toBeInTheDocument();
  });

  it('has no stat note for a link without stat effects', () => {
    renderSection({ id: 'ash', name: 'Ash', traitLinks: [link('brave', 'trait')] }, 'brave');
    expect(screen.queryByText(/Stat changes apply/)).toBeNull();
  });
});
