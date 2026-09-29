import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, openTraitFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
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

const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    { id: 'aldric', name: 'Sir Aldric', persona: true, playerDescription: 'A knight.', aiDescription: 'A knight.', locations: ['harbor'] },
  ],
  traitGroups: [{ id: 'g-class', name: 'Class', parentId: null, maxPicks: 1 }],
  traits: [
    { id: 't-paladin', name: 'Paladin', groupId: 'g-class', statChanges: [] },
    { id: 't-rogue', name: 'Rogue', groupId: 'g-class', statChanges: [] },
    { id: 't-plate', name: 'Plate Armor', statChanges: [], requires: [{ kind: 'trait', id: 't-paladin' }] },
    { id: 't-loose', name: 'Lamp-Lit', statChanges: [] },
    { id: 't-mark', name: 'Guild Mark', statChanges: [], requires: [{ kind: 'trait', id: 'gone', name: 'Thief' }] },
  ],
} as Partial<World>);

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

/** The tree row that draws `name`, found by its drag grip so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name)) as HTMLElement;

const selectTrait = (name: string) => {
  openTab(/Traits/);
  fireEvent.click(treeRow(name));
  openTraitFieldsTab('Availability');
};

/** The Requires field's body, from its label down. */
const requiresField = () => screen.getByRole('group', { name: 'Requires' });

const traitRequires = (ctx: () => { traits: World['traits'] }, id: string) => ctx().traits.find((t) => t.id === id)?.requires;

const selectedRowText = () => document.querySelector('[data-editor-row-selected]')?.textContent;

beforeEach(() => { localStorage.clear(); });

describe('the Requires field', () => {
  it('adds a requirement from the picker, which lists each section with where its target lives', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Lamp-Lit');
    expect(within(requiresField()).getByText('Available when any one of these holds')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));

    const list = await screen.findByRole('listbox');
    expect(within(list).getByText('Traits')).toBeInTheDocument();
    expect(within(list).getByText('Any Trait in a Group')).toBeInTheDocument();
    expect(within(list).getByText('Playing As')).toBeInTheDocument();
    const paladin = within(list).getByRole('option', { name: /^Paladin/ });
    expect(paladin).toHaveTextContent('PaladinClass');
    expect(within(list).getByRole('option', { name: /^playing as Sir Aldric/ })).toBeInTheDocument();
    expect(within(list).queryByRole('option', { name: /Odd Wick/ })).toBeNull();

    // A target asks which bearer next; the same bearer is the plain requirement.
    fireEvent.click(paladin);
    fireEvent.click(screen.getByRole('option', { name: /^Same Bearer/ }));
    expect(traitRequires(ctx, 't-loose')).toEqual([{ kind: 'trait', id: 't-paladin' }]);
    expect(within(requiresField()).getByRole('button', { name: 'Paladin' })).toBeInTheDocument();
  });

  it('joins chips with "or" and filters the picker by name', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Plate Armor');
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    const list = await screen.findByRole('listbox');
    // A requirement already listed stays in place; its bearer reads disabled on the next page.
    fireEvent.click(within(list).getByRole('option', { name: /^Paladin/ }));
    expect(screen.getByRole('option', { name: /^Same Bearer/ })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back to targets' }));
    const search = screen.getByPlaceholderText('Search traits, groups, and personas');
    // The search reads what a row shows, never the requirement key behind it.
    fireEvent.change(search, { target: { value: 'trait' } });
    expect(screen.queryAllByRole('option')).toEqual([]);
    fireEvent.change(search, { target: { value: 'any cl' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['any ClassWorld']);
    fireEvent.click(screen.getByRole('option', { name: /any Class/ }));
    fireEvent.click(screen.getByRole('option', { name: /^Same Bearer/ }));

    expect(traitRequires(ctx, 't-plate')).toEqual([{ kind: 'trait', id: 't-paladin' }, { kind: 'group', id: 'g-class' }]);
    expect(within(requiresField()).getByText('or')).toBeInTheDocument();
  });

  it('removes a requirement, and leaves the field absent once the last one goes', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Plate Armor');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Paladin' }));
    expect(traitRequires(ctx, 't-plate')).toBeUndefined();
    expect(within(requiresField()).queryByRole('button', { name: 'Paladin' })).toBeNull();
  });

  it('opens the target trait from its chip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Plate Armor');
    fireEvent.click(within(requiresField()).getByRole('button', { name: 'Paladin' }));
    expect(selectedRowText()).toBe('Paladin');
  });

  it('opens a group chip\'s group and a playing-as chip\'s entity', () => {
    const world = benchEditorWorld({
      ...WORLD,
      traits: WORLD.traits.map((t) => (t.id === 't-plate'
        ? { ...t, requires: [{ kind: 'group', id: 'g-class' }, { kind: 'playingAs', id: 'aldric' }] }
        : t)),
    } as Partial<World>);
    renderWorldEditorBench(world, 'advanced');
    selectTrait('Plate Armor');
    fireEvent.click(within(requiresField()).getByRole('button', { name: 'any Class' }));
    expect(selectedRowText()).toBe('Class');

    selectTrait('Plate Armor');
    fireEvent.click(within(requiresField()).getByRole('button', { name: 'playing as Sir Aldric' }));
    expect(screen.getByRole('tab', { name: /Entities/ })).toHaveAttribute('aria-selected', 'true');
    expect(selectedRowText()).toContain('Sir Aldric');
  });

  it('reads an unresolved requirement red under its stored name, with nothing to open', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Guild Mark');
    const chip = within(requiresField()).getByText('Thief').closest('[data-unresolved]');
    expect(chip).toHaveClass('text-destructive');
    expect(within(requiresField()).queryByRole('button', { name: 'Thief' })).toBeNull();
    expect(within(requiresField()).getByRole('button', { name: 'Remove Thief' })).toBeInTheDocument();
  });
});

describe('gate marks on the Traits tree', () => {
  it('marks a gated row with a lock and its count, with the full rule as the tip', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    const row = treeRow('Plate Armor');
    expect(row).toHaveTextContent(/Plate Armor1$/);
    expect(row.querySelector('.lucide-lock')).not.toBeNull();
    expect(treeRow('Lamp-Lit').querySelector('.lucide-lock')).toBeNull();
    act(() => { (within(row).getByText('1').closest('[tabindex]') as HTMLElement).focus(); });
    expect(await screen.findByText('Requires Paladin')).toBeInTheDocument();
  });

  it('tints a row red when a requirement points at nothing', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    expect(within(treeRow('Guild Mark')).getByText('Guild Mark').closest('.text-destructive')).not.toBeNull();
    expect(within(treeRow('Plate Armor')).getByText('Plate Armor').closest('.text-destructive')).toBeNull();
  });

  it('leaves a dependent locked, never open, when its target is deleted', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    act(() => { ctx().removeTrait('t-paladin'); });
    expect(traitRequires(ctx, 't-plate')).toEqual([{ kind: 'trait', id: 't-paladin' }]);
    const row = treeRow('Plate Armor');
    expect(row.querySelector('.lucide-lock')).not.toBeNull();
    expect(within(row).getByText('Plate Armor').closest('.text-destructive')).not.toBeNull();
  });
});
