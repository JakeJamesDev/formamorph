import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import TraitTree from './TraitTree';
import type { Entity, Trait, TraitGroup } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const traits = [
  trait('paladin', { name: 'Paladin', groupId: 'classes', order: 0 }),
  trait('brave', { name: 'Brave', groupId: null, order: 1, statChanges: [{ statId: 's', value: 1, type: 'min' }] }),
  trait('calm', { name: 'Calm', groupId: null, order: 2 }),
];
const traitGroups: TraitGroup[] = [{ id: 'classes', name: 'Classes', parentId: null, order: 0 }];
const ash: Entity = {
  id: 'ash', name: 'Ash',
  traits: [trait('pack', { name: 'Pack', groupId: null, order: 0 })],
  traitLinks: [
    { id: 'l-brave', originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null, order: 1 },
    { id: 'l-classes', originalId: 'classes', kind: 'group', originalName: 'Classes', groupId: null, order: 2 },
    { id: 'l-calm', originalId: 'calm', kind: 'trait', originalName: 'Calm', groupId: null, order: 3 },
  ],
};
const bob: Entity = { id: 'bob', name: 'Bob', traitLinks: [{ id: 'l-bob', originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null }] };

function setup(start: Entity[] = [ash, bob]) {
  const onSelect = vi.fn();
  const removeTrait = vi.fn();
  const removeTraitGroup = vi.fn();
  let entities: Entity[] = [];
  function Harness() {
    const [current, setCurrent] = useState<Entity[]>(start);
    entities = current;
    const store = {
      traits, traitGroups, entities: current, placeholders: [], stats: [],
      gateInput: { owners: [], active: {}, entities: [], persona: { source: 'none' } },
      setTraits: vi.fn(), setTraitGroups: vi.fn(), removeTrait, removeTraitGroup,
      editEntity: (id: string, edit: (e: Entity) => Entity) => setCurrent((es) => es.map((e) => (e.id === id ? edit(e) : e))),
    } as unknown as TraitStore;
    return <TraitStoreContext.Provider value={store}><TraitTree selectedId={null} onSelect={onSelect} /></TraitStoreContext.Provider>;
  }
  render(<Harness />);
  return { onSelect, removeTrait, removeTraitGroup, entity: (id: string) => entities.find((e) => e.id === id)! };
}

// The row holding the nth label with this text; world and link rows share their original's name.
const row = (label: string, n = 0) => screen.getAllByText(label)[n].closest('.cursor-pointer') as HTMLElement;
const action = (label: string, n: number, title: string) => within(row(label, n)).queryByRole('button', { name: title });

describe('TraitTree link rows', () => {
  it('draws a link with a link icon that opens its original', () => {
    const { onSelect } = setup();
    fireEvent.click(within(row('Brave', 1)).getByRole('button', { name: 'Open Brave' }));
    expect(onSelect).toHaveBeenCalledWith('brave');
    expect(within(row('Brave', 0)).queryByRole('button', { name: 'Open Brave' })).toBeNull();
  });

  it('offers Detach and Remove Link on a link where an owned row offers Duplicate and Delete', () => {
    setup();
    expect(action('Brave', 1, 'Detach')).not.toBeNull();
    expect(action('Brave', 1, 'Remove Link')).not.toBeNull();
    expect(action('Brave', 1, 'Duplicate')).toBeNull();
    expect(action('Pack', 0, 'Duplicate')).not.toBeNull();
    expect(action('Pack', 0, 'Detach')).toBeNull();
  });

  it("shows a linked group's live subtree as rows that open their original and can't be removed", () => {
    const { entity, onSelect } = setup();
    // Paladin: the world row, then the linked group's row of it.
    const linked = row('Paladin', 1);
    fireEvent.click(within(linked).getByRole('button', { name: 'Open Paladin' }));
    expect(onSelect).toHaveBeenCalledWith('paladin');
    const remove = within(linked).getByRole('button', { name: 'Remove' });
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(remove);
    expect(entity('ash').traitLinks?.map((l) => l.id)).toEqual(['l-brave', 'l-classes', 'l-calm']);
    expect(within(linked).queryByRole('button', { name: 'Detach' })).toBeNull();
  });

  it('marks a link row that overrides its original with a dot, in a linked group too', () => {
    const overridden: Entity = {
      ...ash,
      traitLinks: ash.traitLinks!.map((l) => (l.id === 'l-brave'
        ? { ...l, overrides: { brave: { isDefault: { value: true, blueprint: false } } } }
        : l.id === 'l-classes' ? { ...l, overrides: { paladin: { playerToggle: { value: true, blueprint: false } } } } : l)),
    };
    setup([overridden, bob]);
    const dot = (label: string, n: number) => within(row(label, n)).queryByLabelText('Modified for this link');
    expect(dot('Brave', 1)).not.toBeNull();
    expect(dot('Paladin', 1)).not.toBeNull();
    expect(dot('Calm', 1)).toBeNull();
    expect(dot('Brave', 0)).toBeNull();
  });

  it('removes a link and leaves the original alone', () => {
    const { entity, removeTrait } = setup();
    fireEvent.click(action('Brave', 1, 'Remove Link')!);
    expect(entity('ash').traitLinks?.map((l) => l.id)).toEqual(['l-classes', 'l-calm']);
    expect(removeTrait).not.toHaveBeenCalled();
  });

  it('detaches a link without stat effects straight into an owned copy and selects it', () => {
    const { entity, onSelect } = setup();
    fireEvent.click(action('Calm', 1, 'Detach')!);
    const copy = entity('ash').traits?.find((t) => t.name === 'Calm');
    expect(copy?.id).not.toBe('calm');
    expect(onSelect).toHaveBeenCalledWith(copy?.id);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('confirms before a Detach that leaves stat effects behind', () => {
    const { entity } = setup();
    fireEvent.click(action('Brave', 1, 'Detach')!);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Detach Brave?');
    expect(dialog).toHaveTextContent("The copy won't keep its stat changes and stat toggles");
    expect(entity('ash').traitLinks?.some((l) => l.id === 'l-brave')).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(entity('ash').traits?.find((t) => t.name === 'Brave')).toMatchObject({ statChanges: [] });
    expect(entity('ash').traitLinks?.some((l) => l.id === 'l-brave')).toBe(false);
  });

  it('confirms deleting a linked original, naming its link count', () => {
    const { removeTrait } = setup();
    fireEvent.click(action('Brave', 0, 'Delete')!);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete Brave?');
    expect(dialog).toHaveTextContent('This also deletes its 2 links.');
    expect(removeTrait).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(removeTrait).toHaveBeenCalledWith('brave');
  });

  it('names one link in the singular, and confirms a linked group too', () => {
    const { removeTraitGroup } = setup();
    fireEvent.click(action('Classes', 0, 'Delete')!);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This also deletes its link.');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(removeTraitGroup).toHaveBeenCalledWith('classes');
  });

  it('deletes an original nobody links without asking', () => {
    const { removeTrait } = setup();
    fireEvent.click(action('Paladin', 0, 'Delete')!);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(removeTrait).toHaveBeenCalledWith('paladin');
  });
});
