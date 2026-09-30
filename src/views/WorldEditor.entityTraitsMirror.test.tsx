import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, within } from '@testing-library/react';
import {
  asMobile, benchEditorWorld, entityFieldsTab, openEditorTab, openTraitFieldsTab, renderWorldEditorBench,
} from '@/test/worldEditorBench';
import type { SortableTreeAdapter } from '@/managers/SortableTree';
import type { FlatTraitNode } from '@/lib/traitTree';
import type { World } from '@/types';

/**
 * The entity panel's Traits tab as a mirror of the Traits tab over one entity: its tree, the toolbar above
 * it, and the details that slide in over the list. Driven through the real editor; what lands in the world
 * is read from the live GameData handle.
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

// dnd-kit's pointer path needs layout jsdom does not have, so a drag is played through the adapter each tree
// hands the scaffold. Every tree on screen is tapped; a test picks the one holding the row it drags.
const adapters: SortableTreeAdapter<FlatTraitNode>[] = [];
vi.mock('@/managers/SortableTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/managers/SortableTree')>();
  return {
    ...actual,
    SortableTree: (props: Parameters<typeof actual.SortableTree<FlatTraitNode>>[0]) => {
      adapters.push(props.adapter);
      return <actual.SortableTree {...props} />;
    },
  };
});
const treeHolding = (rowId: string) =>
  [...adapters].reverse().find((a) => a.getVisible(new Set()).some((r) => r.id === rowId))!;

const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'wick', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    {
      id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
      traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, order: 0 }],
      traits: [
        { id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [], order: 0 },
        {
          id: 't-wild', name: 'Wild', groupId: 'g-bond', statChanges: [], order: 1,
          requires: [{ kind: 'trait', id: 't-paladin' }, { kind: 'trait', id: 't-tamed' }, { kind: 'trait', id: 't-tamer' }],
        },
        { id: 't-pack', name: 'Pack Sense', groupId: null, statChanges: [], order: 2 },
      ],
      traitLinks: [{ id: 'l-tamer', originalId: 't-tamer', kind: 'trait', originalName: 'Beast Tamer', groupId: null, order: 1 }],
    },
  ],
  traitGroups: [{ id: 'g-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  traits: [
    { id: 't-paladin', name: 'Paladin', statChanges: [] },
    { id: 't-tamer', name: 'Beast Tamer', groupId: 'g-blueprints', statChanges: [{ statId: 's1', value: 1 }] },
  ],
} as Partial<World>);

const openTab = openEditorTab;
const selectEntity = (name: string) => fireEvent.click(screen.getAllByText(name)[0]);
const openMirror = (name: string) => {
  openTab(/Entities/);
  selectEntity(name);
  fireEvent.mouseDown(entityFieldsTab('Traits'));
};
const searchBox = () => screen.getByPlaceholderText('Search or add new traits');
const openAddMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Add to ${name}` }));
/** The mirror's draggable rows, in order: the entity panel's own, apart from the entity tree's rows beside it. */
const mirrorRows = () => {
  // The tabs root, past the row a pushed panel's back arrow shares with the strip.
  const panel = screen.getByRole('tablist', { name: 'Entity Fields' }).parentElement!.closest('[dir][data-orientation]') as HTMLElement;
  return within(panel).getAllByLabelText('Drag to reorder or nest').map((grip) => grip.parentElement as HTMLElement);
};
const rowNamed = (name: string) => mirrorRows().find((row) => within(row).queryByText(name));
const detailsOpen = () => !!screen.queryByRole('tablist', { name: 'Trait Fields' });
const backArrow = () => screen.queryByRole('button', { name: 'Back to Traits' });
/** Whether the back arrow named `name` shares a row with the strip named `strip`, left of it. */
const leadsStrip = (name: string, strip: string) => {
  const list = screen.getByRole('tablist', { name: strip });
  const arrow = within(list.parentElement!).queryByRole('button', { name });
  return !!arrow && !list.contains(arrow) && !!(arrow.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING);
};
const entity = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!;

beforeEach(() => { localStorage.clear(); adapters.length = 0; });

describe('the entity Traits tab as a mirror', () => {
  it('draws the entity\'s tree with the Traits tab\'s rows, buttons and gate counts, links among them', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    expect(mirrorRows().map((r) => r.textContent)).toEqual(['Bond', 'Tamed', 'Wild3', 'Beast Tamer', 'Pack Sense']);
    expect(within(rowNamed('Tamed')!).getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(within(rowNamed('Tamed')!).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    // The link's row sits at the entity's root among its own items and opens as itself.
    const link = screen.getByRole('button', { name: 'Open Beast Tamer' });
    const linkRow = link.closest('.cursor-pointer') as HTMLElement;
    expect(within(linkRow).getByRole('button', { name: 'Remove Link' })).toBeInTheDocument();
    expect(within(linkRow).getByLabelText('Drag to reorder or nest')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Help/ })).toBeNull();
  });

  it('offers Add Trait and Add Group to the entity only, names the new trait from the search text, and slides its details in', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.change(searchBox(), { target: { value: 'Fangs' } });
    openAddMenu('Ash');
    expect(screen.getAllByRole('button', { name: /^Add .+ to Ash$/ }).map((b) => b.textContent?.trim())).toEqual(['Add Group to Ash', 'Add Trait to Ash']);
    expect(screen.queryByRole('button', { name: /Link Trait/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Trait to Ash' }));
    expect(entity(ctx, 'ash').traits!.map((t) => t.name)).toEqual(['Tamed', 'Wild', 'Pack Sense', 'Fangs']);
    expect(searchBox()).toHaveValue('');
    expect(leadsStrip('Back to Traits', 'Trait Fields')).toBe(true);
    expect(screen.getByLabelText('Name')).toHaveTextContent('Fangs');
    // Still inside the entity, on its own Traits tab.
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
    expect(entityFieldsTab('Traits')).toHaveAttribute('aria-selected', 'true');
  });

  it('searches the entity\'s traits and links flat, lists no group, and says when nothing matches', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.change(searchBox(), { target: { value: 'ta' } });
    expect(screen.getByText('Tamed')).toBeInTheDocument();
    expect(screen.getByText('Beast Tamer')).toBeInTheDocument();
    expect(screen.queryByText('Bond')).toBeNull();
    expect(screen.queryByText('Pack Sense')).toBeNull();
    fireEvent.change(searchBox(), { target: { value: 'zzz' } });
    expect(screen.getByText('No traits match “zzz”.')).toBeInTheDocument();
  });

  it('returns to the list from the back arrow, and keeps the open trait across a tab switch', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.click(rowNamed('Wild')!);
    expect(screen.getByLabelText('Name')).toHaveTextContent('Wild');
    fireEvent.mouseDown(entityFieldsTab('Profile'));
    expect(detailsOpen()).toBe(false);
    fireEvent.mouseDown(entityFieldsTab('Traits'));
    expect(screen.getByLabelText('Name')).toHaveTextContent('Wild');
    fireEvent.click(backArrow()!);
    expect(detailsOpen()).toBe(false);
    expect(rowNamed('Wild')).toBeDefined();
  });

  it('returns to the list when another entity is selected, and again when the first comes back', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.click(rowNamed('Tamed')!);
    expect(detailsOpen()).toBe(true);
    selectEntity('Odd Wick');
    expect(entityFieldsTab('Traits')).toHaveAttribute('aria-selected', 'true');
    expect(detailsOpen()).toBe(false);
    expect(screen.getByText(/Add a trait to give this entity a node on the/)).toBeInTheDocument();
    selectEntity('Ash');
    expect(detailsOpen()).toBe(false);
    expect(mirrorRows().map((r) => r.textContent)).toEqual(['Bond', 'Tamed', 'Wild3', 'Beast Tamer', 'Pack Sense']);
  });

  it('reorders inside the entity, counting a link\'s place, and never moves a world trait', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    // Pack Sense dragged above the Beast Tamer link: Bond, Pack Sense, Beast Tamer at the root.
    act(() => treeHolding('t-pack').onDrop('t-pack', 'l-tamer', 0, new Set()));
    const ash = entity(ctx, 'ash');
    expect(ash.traits!.find((t) => t.id === 't-pack')).toMatchObject({ groupId: null, order: 1 });
    expect(ash.traitLinks![0]).toMatchObject({ id: 'l-tamer', order: 2 });
    expect(mirrorRows().map((r) => r.textContent)).toEqual(['Bond', 'Tamed', 'Wild3', 'Pack Sense', 'Beast Tamer']);
    // Then into Bond, one indent right onto Wild's slot.
    act(() => treeHolding('t-pack').onDrop('t-pack', 't-wild', 24, new Set()));
    expect(entity(ctx, 'ash').traits!.find((t) => t.id === 't-pack')).toMatchObject({ groupId: 'g-bond' });
    expect(ctx().traits.map((t) => t.id)).toEqual(['t-paladin', 't-tamer']);
  });

  it("drags a link's own row into an own group", () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    act(() => treeHolding('l-tamer').onDrop('l-tamer', 't-wild', 24, new Set()));
    expect(entity(ctx, 'ash').traitLinks![0]).toMatchObject({ id: 'l-tamer', groupId: 'g-bond' });
    expect(mirrorRows().map((r) => r.textContent)).toEqual(['Bond', 'Tamed', 'Beast Tamer', 'Wild3', 'Pack Sense']);
  });

  it('opens a Requires chip the entity holds, and reads one it does not as plain text', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    const field = () => screen.getByRole('group', { name: 'Requires' });
    fireEvent.click(rowNamed('Wild')!);
    openTraitFieldsTab('Availability');
    // Paladin is a world trait: named, never a button, and the details stay open.
    expect(within(field()).getByText('Paladin')).toBeInTheDocument();
    expect(within(field()).queryByRole('button', { name: 'Paladin' })).toBeNull();
    fireEvent.click(within(field()).getByRole('button', { name: 'Beast Tamer' }));
    openTraitFieldsTab('Details');
    expect(screen.getByText(/^Linked from/)).toBeInTheDocument();
    openTraitFieldsTab('Availability');
    fireEvent.click(backArrow()!);
    fireEvent.click(rowNamed('Wild')!);
    fireEvent.click(within(field()).getByRole('button', { name: 'Tamed' }));
    openTraitFieldsTab('Details');
    expect(screen.getByLabelText('Name')).toHaveTextContent('Tamed');
  });

  it('edits a link as its own overrides, with Reset to Blueprint and no way to the Traits tab', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.click(screen.getByRole('button', { name: 'Open Beast Tamer' }));
    const line = screen.getByText(/^Linked from/);
    expect(line).toHaveTextContent('Linked from Blueprints › Beast Tamer');
    expect(within(line).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Blueprint' })).toBeNull();
    openTraitFieldsTab('Availability');
    fireEvent.click(screen.getByRole('checkbox', { name: /Enabled by Default/ }));
    expect(entity(ctx, 'ash').traitLinks![0].overrides).toEqual({ 't-tamer': { isDefault: { value: true, blueprint: false } } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
    expect(entity(ctx, 'ash').traitLinks![0]).not.toHaveProperty('overrides');
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
  });

  it('shows a trait\'s details without an Owned by line, since the panel already names the entity', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.click(rowNamed('Tamed')!);
    expect(screen.getByLabelText('Name')).toHaveTextContent('Tamed');
    expect(screen.queryByText(/^Owned by/)).toBeNull();
    // Ash is a persona, so the trait has a Stats tab (Q10).
    expect(within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name: 'Stats' })).toBeInTheDocument();
  });

  it('pushes the details in over the mirror on mobile, each push with its arrow leading its own tab strip', () => {
    const undo = asMobile();
    try {
      renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      expect(leadsStrip('Back to Entities', 'Entity Fields')).toBe(true);
      expect(screen.getAllByRole('button', { name: /^Back to / })).toHaveLength(1);
      fireEvent.click(rowNamed('Tamed')!);
      expect(leadsStrip('Back to Traits', 'Trait Fields')).toBe(true);
      expect(leadsStrip('Back to Entities', 'Entity Fields')).toBe(true);
      // No push draws a row of its own for the control.
      expect(screen.queryByRole('button', { name: /^(Back|Traits|Entities)$/ })).toBeNull();
      fireEvent.click(backArrow()!);
      expect(detailsOpen()).toBe(false);
      expect(screen.getByRole('tablist', { name: 'Entity Fields' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Back to Entities' }));
      expect(screen.queryByRole('tablist', { name: 'Entity Fields' })).toBeNull();
    } finally {
      undo();
    }
  });

  it('leads a strip-less group detail\'s first row with its arrow on mobile, and goes back from it', () => {
    const undo = asMobile();
    try {
      renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      fireEvent.click(rowNamed('Bond')!);
      const name = screen.getByRole('textbox', { name: 'Group Name' });
      const row = screen.getByRole('button', { name: 'Back to Traits' }).parentElement!;
      expect(row.contains(name)).toBe(true);
      expect(row.firstElementChild).toHaveAccessibleName('Back to Traits');
      fireEvent.click(backArrow()!);
      expect(rowNamed('Bond')).toBeDefined();
      expect(screen.queryByRole('textbox', { name: 'Group Name' })).toBeNull();
    } finally {
      undo();
    }
  });
});
