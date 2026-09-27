import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The Traits tab's faster authoring: the + menu's add-to-entity drill-in and the link button's flyout. */

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

// Entities tab: Heroes (Albus, who links Paladin; Mira; City Guard (Tomas)), Vex. Brave sits at the top level.
const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e-vex', name: 'Vex', groupId: null, order: 1 },
    { id: 'e-mira', name: 'Mira', groupId: 'g-heroes', order: 1 },
    { id: 'e-tomas', name: 'Tomas', groupId: 'g-guard', order: 0 },
    {
      id: 'e-albus', name: 'Albus', groupId: 'g-heroes', order: 0,
      traits: [{ id: 't-oath', name: 'Oath', statChanges: [], groupId: null, order: 0 }],
      traitLinks: [{ id: 'l-paladin', originalId: 't-paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 1 }],
    },
  ],
  entityGroups: [{ id: 'g-heroes', name: 'Heroes', parentId: null, order: 0 }, { id: 'g-guard', name: 'City Guard', parentId: 'g-heroes', order: 2 }],
  traits: [
    { id: 't-brave', name: 'Brave', statChanges: [], groupId: null, order: 1 },
    { id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'g-templates', order: 0 },
  ],
  traitGroups: [{ id: 'g-templates', name: 'Templates', parentId: null, order: 0, system: 'templates' }],
  customPersona: { traitLinks: [] },
} as Partial<World>);

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const openAddMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Add to Traits' }));
const menuButton = (name: string) => screen.queryByRole('button', { name });

/** A tree row found by its drag grip, so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.queryAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name, { exact: true }));

/** A flyout level's rows in order: `#` marks a group that opens a level, `✓` a held bearer. */
const flyoutRows = (label: string) => [...screen.getByRole('group', { name: label }).children].map((row) =>
  `${row.querySelector('.lucide-chevron-right') ? '#' : ''}${(row as HTMLButtonElement).disabled ? '✓' : ''}${row.textContent}`);
const flyoutRow = (label: string, name: string) => within(screen.getByRole('group', { name: label })).getByRole('button', { name });

beforeEach(() => { localStorage.clear(); });

describe('the + menu', () => {
  it('offers Add Trait To Entity in Basic, and Add Group To Entity in Advanced only', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openTab(/Traits/);
    openAddMenu();
    expect(menuButton('Add Trait')).toBeInTheDocument();
    expect(menuButton('Add Trait To Entity')).toBeInTheDocument();
    expect(menuButton('Add Group To Entity')).toBeNull();
    expect(menuButton('Add Group')).toBeNull();
  });

  it('adds an owned trait to an entity with no node, which gets one with the new row selected', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openTab(/Traits/);
    expect(treeRow('Mira')).toBeUndefined();
    openAddMenu();
    fireEvent.click(menuButton('Add Trait To Entity')!);
    // Custom Persona holds links only, so the add list leaves it out (Q69).
    expect(flyoutRows('Entities')).toEqual(['#Heroes', 'Vex']);
    fireEvent.click(flyoutRow('Entities', 'Heroes'));
    expect(flyoutRows('Entities')).toEqual(['Albus', 'Mira', '#City Guard']);
    fireEvent.click(flyoutRow('Entities', 'Mira'));

    const mira = ctx().entities.find((e) => e.id === 'e-mira')!;
    expect(mira.traits).toEqual([expect.objectContaining({ name: 'New Trait', groupId: null, order: 0 })]);
    expect(treeRow('Mira')).toBeDefined();
    expect(treeRow('New Trait')).toHaveAttribute('data-editor-row-selected');
    expect(screen.getByText(/Owned by/)).toHaveTextContent('Owned by Mira');
    expect(screen.queryByRole('group', { name: 'Entities' })).toBeNull();
  });

  it('adds an owned group in Advanced, revealing it inside a collapsed entity node', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(within(treeRow('Albus')!).getByRole('button', { name: 'Collapse entity' }));
    expect(treeRow('Oath')).toBeUndefined();
    openAddMenu();
    fireEvent.click(menuButton('Add Group To Entity')!);
    fireEvent.click(flyoutRow('Entities', 'Heroes'));
    fireEvent.click(flyoutRow('Entities', 'Albus'));

    // It follows Oath and the Paladin link at Albus's top level.
    expect(ctx().entities.find((e) => e.id === 'e-albus')!.traitGroups)
      .toEqual([expect.objectContaining({ name: 'New Group', parentId: null, order: 2 })]);
    expect(treeRow('New Group')).toHaveAttribute('data-editor-row-selected');
    expect(treeRow('Oath')).toBeDefined();
  });

  it('goes back one level at a time, from a nested group to the menu', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    openAddMenu();
    fireEvent.click(menuButton('Add Trait To Entity')!);
    fireEvent.click(flyoutRow('Entities', 'Heroes'));
    fireEvent.click(flyoutRow('Entities', 'City Guard'));
    expect(flyoutRows('Entities')).toEqual(['Tomas']);
    fireEvent.click(menuButton('City Guard')!);
    expect(flyoutRows('Entities')).toEqual(['Albus', 'Mira', '#City Guard']);
    fireEvent.click(menuButton('Heroes')!);
    expect(flyoutRows('Entities')).toEqual(['#Heroes', 'Vex']);
    fireEvent.click(menuButton('Add Trait To Entity')!);
    expect(menuButton('Add Templates Group')).toBeNull();
    expect(menuButton('Add Group To Entity')).toBeInTheDocument();
  });
});

describe('the link button', () => {
  const openLinkFlyout = () => fireEvent.click(screen.getByRole('button', { name: 'Link To…' }));

  it('lists Custom Persona first, then entities by group, with bearers that have the original checked and disabled', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(within(treeRow('Paladin')!).getByText('Paladin'));
    openLinkFlyout();
    expect(flyoutRows('Link To')).toEqual(['Custom Persona', '#Heroes', 'Vex']);
    fireEvent.click(flyoutRow('Link To', 'Heroes'));
    expect(flyoutRows('Link To')).toEqual(['✓Albus', 'Mira', '#City Guard']);
    expect(flyoutRow('Link To', 'Albus')).toHaveAttribute('aria-pressed', 'true');

    // A pick links through the drag's path; the flyout stays open with the new bearer checked.
    fireEvent.click(flyoutRow('Link To', 'Mira'));
    expect(ctx().entities.find((e) => e.id === 'e-mira')!.traitLinks).toEqual([
      expect.objectContaining({ originalId: 't-paladin', kind: 'trait', groupId: null, order: 0 }),
    ]);
    expect(flyoutRows('Link To')).toEqual(['✓Albus', '✓Mira', '#City Guard']);

    fireEvent.click(menuButton('Heroes')!);
    fireEvent.click(flyoutRow('Link To', 'Custom Persona'));
    expect(ctx().customPersona?.traitLinks).toEqual([expect.objectContaining({ originalId: 't-paladin', order: 0 })]);
  });

  it('checks Custom Persona for a top-level trait, which the player already has', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(within(treeRow('Brave')!).getByText('Brave'));
    openLinkFlyout();
    expect(flyoutRows('Link To')).toEqual(['✓Custom Persona', '#Heroes', 'Vex']);
  });

  it('shows on a selected link, acting on its original', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    const link = screen.getAllByLabelText('Drag to reorder or nest')
      .map((grip) => grip.parentElement as HTMLElement)
      .find((row) => within(row).queryByRole('button', { name: 'Open Paladin' }))!;
    fireEvent.click(within(link).getByText('Paladin'));
    expect(screen.getByText(/Linked from/)).toBeInTheDocument();
    openLinkFlyout();
    fireEvent.click(flyoutRow('Link To', 'Heroes'));
    expect(flyoutRows('Link To')).toEqual(['✓Albus', 'Mira', '#City Guard']);
  });

  it('never shows in Basic, on an owned trait, or on Templates', () => {
    const { unmount } = renderWorldEditorBench(WORLD, 'simple');
    openTab(/Traits/);
    fireEvent.click(within(treeRow('Brave')!).getByText('Brave'));
    expect(menuButton('Link To…')).toBeNull();
    unmount();

    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(within(treeRow('Oath')!).getByText('Oath'));
    expect(screen.getByText(/Owned by/)).toBeInTheDocument();
    expect(menuButton('Link To…')).toBeNull();
    fireEvent.click(within(treeRow('Templates')!).getByText('Templates'));
    expect(menuButton('Link To…')).toBeNull();
  });
});
