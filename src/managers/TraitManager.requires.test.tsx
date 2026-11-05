import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { panelWorld, openTraitFieldsTab } from '@/test/panelBench';
import { renderTraitsTab } from '@/test/traitsTabBench';
import type { World } from '@/types';

/**
 * The trait panel's Requires field and the gate marks on the Traits tree, driven through the real editor.
 * What a requirement unlocks is the gate module's to test; this covers the wiring an author touches.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD: World = panelWorld({
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    { id: 'aldric', name: 'Sir Aldric', persona: true, playerDescription: 'A knight.', aiDescription: 'A knight.', locations: ['harbor'] },
  ],
  traitGroups: [{ id: 'g-class', name: 'Class', parentId: null, maxPicks: 1 }],
  traits: [
    { id: 't-paladin', name: 'Paladin', groupId: 'g-class', statChanges: [] },
    { id: 't-rogue', name: 'Rogue', groupId: 'g-class', statChanges: [] },
    { id: 't-plate', name: 'Plate Armor', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 't-paladin' }] }] },
    { id: 't-loose', name: 'Lamp-Lit', statChanges: [] },
    { id: 't-mark', name: 'Guild Mark', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 'gone', name: 'Thief' }] }] },
  ],
} as Partial<World>);

/** The tree row that draws `name`, found by its drag grip so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name)) as HTMLElement;

const selectTrait = (name: string) => {
  fireEvent.click(treeRow(name));
  openTraitFieldsTab('Availability');
};

/** The Requires field's body, from its label down. */
const requiresField = () => screen.getByRole('group', { name: 'Requires' });

const traitRequires = (ctx: () => { traits: World['traits'] }, id: string) => ctx().traits.find((t) => t.id === id)?.requires;

beforeEach(() => { localStorage.clear(); });

describe('the Requires field', () => {
  it('adds a requirement from the picker, which lists each section with where its target lives', async () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    selectTrait('Lamp-Lit');
    expect(within(requiresField()).queryByText(/any one of these/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));

    const list = await screen.findByRole('listbox');
    expect(within(list).getByText('Traits')).toBeInTheDocument();
    expect(within(list).getByText('Any Trait in a Group')).toBeInTheDocument();
    expect(within(list).getByText('Playing As')).toBeInTheDocument();
    const paladin = within(list).getByRole('option', { name: /^Paladin/ });
    expect(paladin).toHaveTextContent('PaladinClass');
    expect(within(list).getByRole('option', { name: /^playing as Sir Aldric/ })).toBeInTheDocument();
    expect(within(list).queryByRole('option', { name: /Odd Wick/ })).toBeNull();

    // Only You can hold a world trait, so the plain requirement is added with no owner page.
    fireEvent.click(paladin);
    expect(screen.queryByRole('option', { name: /^Same Owner/ })).toBeNull();
    expect(traitRequires(ctx, 't-loose')).toEqual([{ all: [{ kind: 'trait', id: 't-paladin' }] }]);
    expect(within(requiresField()).getByRole('button', { name: 'Paladin' })).toBeInTheDocument();
  });

  it('adds another way as a row joined by "or", and filters the picker by name', async () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    selectTrait('Plate Armor');
    fireEvent.click(screen.getByRole('button', { name: 'Or Another Way' }));
    const list = await screen.findByRole('listbox');
    // A one-chip row already listed stays in place and reads disabled.
    expect(within(list).getByRole('option', { name: /^Paladin/ })).toHaveAttribute('aria-disabled', 'true');
    const search = screen.getByPlaceholderText('Search traits, groups, time of day, and personas');
    // The search reads what a row shows, never the requirement key behind it.
    fireEvent.change(search, { target: { value: 'trait' } });
    expect(screen.queryAllByRole('option')).toEqual([]);
    fireEvent.change(search, { target: { value: 'any cl' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['any ClassWorld']);
    fireEvent.click(screen.getByRole('option', { name: /any Class/ }));

    expect(traitRequires(ctx, 't-plate')).toEqual([{ all: [{ kind: 'trait', id: 't-paladin' }] }, { all: [{ kind: 'group', id: 'g-class' }] }]);
    expect(within(requiresField()).getByText('or')).toBeInTheDocument();
  });

  it('asks which owner when an entity also has the target, and adds for the one picked', async () => {
    const world = panelWorld({
      ...WORLD,
      entities: [
        ...WORLD.entities,
        {
          id: 'ash', name: 'Ash', playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
          traits: [{ id: 't-tamed', name: 'Tamed', statChanges: [] }],
        },
      ],
    } as Partial<World>);
    const { ctx } = renderTraitsTab(world, 'advanced');
    selectTrait('Lamp-Lit');
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: /^Tamed/ }));

    const page = screen.getAllByRole('option').map((o) => o.textContent);
    expect(page).toEqual(['Same OwnerWhoever has the trait', 'Persona', 'Ash']);
    fireEvent.click(screen.getByRole('option', { name: /^Ash/ }));
    expect(traitRequires(ctx, 't-loose')).toEqual([{ all: [{ kind: 'trait', id: 't-tamed', owner: { kind: 'entity', id: 'ash', name: 'Ash' } }] }]);
  });

  it('reads a target already listed for You as listed, so a world trait cannot take it twice', async () => {
    const world = panelWorld({
      ...WORLD,
      traits: WORLD.traits.map((t) => (t.id === 't-plate'
        ? { ...t, requires: [{ all: [{ kind: 'trait', id: 't-paladin', owner: { kind: 'you' } }] }] }
        : t)),
    } as Partial<World>);
    renderTraitsTab(world, 'advanced');
    selectTrait('Plate Armor');
    fireEvent.click(screen.getByRole('button', { name: 'Or Another Way' }));
    expect(within(await screen.findByRole('listbox')).getByRole('option', { name: /^Paladin/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('removes a requirement, and leaves the field absent once the last one goes', () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    selectTrait('Plate Armor');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Paladin' }));
    expect(traitRequires(ctx, 't-plate')).toBeUndefined();
    expect(within(requiresField()).queryByRole('button', { name: 'Paladin' })).toBeNull();
  });

  it('reads an unresolved requirement red under its stored name, with nothing to open', () => {
    renderTraitsTab(WORLD, 'advanced');
    selectTrait('Guild Mark');
    const chip = within(requiresField().querySelector<HTMLElement>('[data-requirement-row]')!).getByText('Thief').closest('[data-unresolved]');
    expect(chip).toHaveClass('text-destructive');
    expect(within(requiresField()).queryByRole('button', { name: 'Thief' })).toBeNull();
    expect(within(requiresField()).getByRole('button', { name: 'Remove Thief' })).toBeInTheDocument();
  });
});
