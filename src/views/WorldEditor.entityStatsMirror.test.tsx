import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode } from 'lexical';
import {
  benchEditorWorld, entityFieldsTab, openEditorTab, renderWorldEditorBench,
} from '@/test/worldEditorBench';
import type { Stat, World } from '@/types';

/**
 * The entity panel's Stats tab as a mirror of the Stats tab over one entity: its rows, the toolbar above
 * them, and the stat panel that slides in over the list. Driven through the real editor; what lands in the
 * world is read from the live GameData handle.
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

// dnd-kit's pointer path needs layout jsdom does not have, so a drop is played through the handler each
// sortable list hands its context.
const drops: ((event: { active: { id: string }; over: { id: string } | null }) => void)[] = [];
vi.mock('@/components/dnd/EditorDndContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/dnd/EditorDndContext')>();
  return {
    ...actual,
    EditorDndContext: (props: Parameters<typeof actual.EditorDndContext>[0]) => {
      if (props.onDragEnd) drops.push(props.onDragEnd as (typeof drops)[number]);
      return <actual.EditorDndContext {...props} />;
    },
  };
});
const drop = (activeId: string, overId: string) =>
  act(() => drops[drops.length - 1]({ active: { id: activeId }, over: { id: overId } }));

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
});

const WORLD: World = benchEditorWorld({
  stats: [stat('s-warmth', 'Warmth')],
  entities: [
    { id: 'wick', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    {
      id: 'ash', name: 'Ash', playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
      stats: [stat('s-trust', 'Trust', { value: 3 }), stat('s-vigor', 'Vigor'), stat('s-hunger', 'Hunger')],
    },
  ],
} as Partial<World>);

const selectEntity = (name: string) => fireEvent.click(screen.getAllByText(name)[0]);
const openMirror = (name: string) => {
  openEditorTab(/Entities/);
  selectEntity(name);
  fireEvent.mouseDown(entityFieldsTab('Stats'));
};
const searchBox = () => screen.getByPlaceholderText('Filter Stats');
const openAddMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Add to ${name}` }));
/** The search list's rows: a labeled select button each, which the tree's rows do not have. */
const searchRowNames = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));
/** The stat tree's rows: the grips inside the stat list, so the Entities tree beside it never counts. */
const statList = () => {
  let el = searchBox().parentElement;
  while (el && !el.querySelector('[aria-label="Drag to reorder or nest"]')) el = el.parentElement;
  return el ?? document.body;
};
const treeRows = () => within(statList()).queryAllByLabelText('Drag to reorder or nest').map((grip) => grip.parentElement as HTMLElement);
const rowNames = () => treeRows().map((r) => r.textContent!);
const treeRow = (name: string) => treeRows().find((r) => within(r).queryByText(name, { exact: true }))!;
const selectRow = (name: string) => fireEvent.click(within(treeRow(name)).getByText(name, { exact: true }));
const ownStats = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!.stats;
const panelOpen = () => !!screen.queryByRole('tablist', { name: 'Stat Fields' });
/** The Details tab's number fields hold no label link, so they are read in the order the panel draws them. */
const numberField = (name: 'Base Value' | 'Min' | 'Max' | 'Regen') =>
  screen.getAllByRole('spinbutton')[['Base Value', 'Min', 'Max', 'Regen'].indexOf(name)];
/** Replaces the Name field's text through its composer, as one edit. */
const setName = (text: string) => act(async () => {
  const field = screen.getByRole('textbox', { name: 'Name' });
  getNearestEditorFromDOMNode(field)!.update(() => {
    $getRoot().clear().append($createParagraphNode().append($createTextNode(text)));
  }, { discrete: true });
});
const statTab = (name: string) => within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name });

beforeEach(() => { localStorage.clear(); drops.length = 0; });

describe('the entity Stats tab', () => {
  it('shows in Advanced mode between Traits and Placeholders, and not in Simple mode', () => {
    const view = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    selectEntity('Ash');
    const tabs = within(screen.getByRole('tablist', { name: 'Entity Fields' })).getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Profile', 'Descriptions', 'Traits', 'Stats', 'Placeholders', 'Openings']);
    view.unmount();

    renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Entities/);
    selectEntity('Ash');
    expect(within(screen.getByRole('tablist', { name: 'Entity Fields' })).queryByRole('tab', { name: 'Stats' })).toBeNull();
  });

  it('lists the entity\'s own stats in order, each with a grip, Duplicate and Delete, and none of the world\'s', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    expect(rowNames()).toEqual(['Trust', 'Vigor', 'Hunger']);
    const trust = treeRow('Trust');
    expect(within(trust).getByLabelText('Drag to reorder or nest')).toBeInTheDocument();
    expect(within(trust).getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(within(trust).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByText('Warmth')).toBeNull();
  });

  it('says so for an entity with no stats', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Odd Wick');
    expect(screen.getByText('Add a stat to track something about this entity')).toBeInTheDocument();
  });

  it('adds a stat to the entity only, names it from the search text, and slides its panel in', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Odd Wick');
    fireEvent.change(searchBox(), { target: { value: 'Lamp Oil' } });
    openAddMenu('Odd Wick');
    expect(screen.getAllByRole('button', { name: /^Add Stat$/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Link Stat/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Stat' }));

    expect(ownStats(ctx, 'wick')).toEqual([
      expect.objectContaining({ name: 'Lamp Oil', type: 'number', min: 0, max: 100, value: 0, regen: 0 }),
    ]);
    expect(ownStats(ctx, 'wick')![0].descriptors.map((d) => d.description))
      .toEqual(['Lamp Oil is low', 'Lamp Oil is medium', 'Lamp Oil is high']);
    expect(ctx().stats.map((s) => s.id)).toEqual(['s-warmth']);
    expect(searchBox()).toHaveValue('');
    expect(panelOpen()).toBe(true);
    expect(screen.getByLabelText('Name')).toHaveTextContent('Lamp Oil');
    // Still inside the entity, on its own Stats tab.
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the same stat panel the Stats tab uses, and writes each field to the entity\'s stat', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    selectRow('Trust');
    expect(['Details', 'Descriptors', 'Scripts'].map((name) => statTab(name))).toHaveLength(3);

    fireEvent.change(numberField('Regen'), { target: { value: '2' } });
    fireEvent.change(numberField('Max'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hidden' }));
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't Decrease" }));
    expect(ownStats(ctx, 'ash')!.find((s) => s.id === 's-trust')).toMatchObject({
      regen: 2, max: 20, hidden: true, noDecrease: true, value: 3,
    });
    // A neighbor and the world's own stat stay as they were.
    expect(ownStats(ctx, 'ash')!.find((s) => s.id === 's-vigor')).toEqual(stat('s-vigor', 'Vigor'));
    expect(ctx().stats).toEqual([stat('s-warmth', 'Warmth')]);
  });

  it('follows a rename into the default descriptors', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Odd Wick');
    openAddMenu('Odd Wick');
    fireEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
    await setName('Oil');
    expect(ownStats(ctx, 'wick')![0].name).toBe('Oil');
    expect(ownStats(ctx, 'wick')![0].descriptors.map((d) => d.description)[0]).toBe('Oil is low');
  });

  it('duplicates a stat right after its original, and deletes one', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.click(within(treeRow('Trust')).getByRole('button', { name: 'Duplicate' }));
    expect(ownStats(ctx, 'ash')!.map((s) => s.name)).toEqual(['Trust', 'Trust (Copy)', 'Vigor', 'Hunger']);
    expect(new Set(ownStats(ctx, 'ash')!.map((s) => s.id)).size).toBe(4);
    expect(screen.getByLabelText('Name')).toHaveTextContent('Trust (Copy)');

    fireEvent.click(screen.getByRole('button', { name: /^Back to Stats/ }));
    fireEvent.click(within(treeRow('Vigor')).getByRole('button', { name: 'Delete' }));
    expect(ownStats(ctx, 'ash')!.map((s) => s.name)).toEqual(['Trust', 'Trust (Copy)', 'Hunger']);
  });

  it('reorders inside the entity and never moves a world stat', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    // A drop on the tree, played through the drop handler the mock holds.
    drop('s-trust', 's-hunger');
    expect(ownStats(ctx, 'ash')!.map((s) => s.id)).toEqual(['s-vigor', 's-hunger', 's-trust']);
    expect(ctx().stats.map((s) => s.id)).toEqual(['s-warmth']);
  });

  it('filters by name and says when nothing matches', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.change(searchBox(), { target: { value: 'v' } });
    expect(searchRowNames()).toEqual(['Vigor']);
    fireEvent.change(searchBox(), { target: { value: 'zzz' } });
    expect(screen.getByText('No stats match “zzz”.')).toBeInTheDocument();
  });

  it('returns to the list when another entity is selected, and keeps the open stat across a tab switch', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    selectRow('Vigor');
    fireEvent.mouseDown(entityFieldsTab('Profile'));
    expect(panelOpen()).toBe(false);
    fireEvent.mouseDown(entityFieldsTab('Stats'));
    expect(screen.getByLabelText('Name')).toHaveTextContent('Vigor');
    selectEntity('Odd Wick');
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
    expect(panelOpen()).toBe(false);
  });
});

describe('the entity Stats tab groups', () => {
  const GROUPED: World = benchEditorWorld({
    stats: [stat('s-warmth', 'Warmth')],
    statGroups: [{ id: 'g-world', name: 'World Group', parentId: null, order: 0 }],
    entities: [
      {
        id: 'ash', name: 'Ash', playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
        stats: [
          stat('s-trust', 'Trust', { groupId: 'g-bond', order: 0 }), stat('s-vigor', 'Vigor', { groupId: null, order: 1 }),
        ],
        statGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, order: 0, aiDescription: 'How Ash feels about you.' }],
      },
    ],
  } as Partial<World>);
  const ownGroups = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!.statGroups;

  /** Replaces the Group Name field's text through its composer, as one edit. */
  const setGroupName = (text: string) => act(async () => {
    const field = screen.getByRole('textbox', { name: 'Group Name' });
    getNearestEditorFromDOMNode(field)!.update(() => {
      $getRoot().clear().append($createParagraphNode().append($createTextNode(text)));
    }, { discrete: true });
  });

  it('draws the entity\'s own groups over their stats and none of the world\'s', () => {
    renderWorldEditorBench(GROUPED, 'advanced');
    openMirror('Ash');
    expect(rowNames()).toEqual(['Bond', 'Trust', 'Vigor']);
    expect(screen.queryByText('World Group')).toBeNull();
  });

  it('adds a group to the entity only, at its top level, and opens the group panel', () => {
    const { ctx } = renderWorldEditorBench(GROUPED, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
    expect(ownGroups(ctx, 'ash')).toEqual([
      expect.objectContaining({ id: 'g-bond' }),
      expect.objectContaining({ name: 'New Group', parentId: null, order: 2 }),
    ]);
    expect(ctx().statGroups?.map((g) => g.id)).toEqual(['g-world']);
    expect(screen.getByLabelText('Group Name')).toBeInTheDocument();
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
  });

  it('reorders the entity\'s stats by a drop and stores them in the order the tree draws', () => {
    const { ctx } = renderWorldEditorBench(GROUPED, 'advanced');
    openMirror('Ash');
    // Vigor is dropped on Bond's row at offset 0, so it takes the first place at the top level.
    drop('s-vigor', 'g-bond');
    expect(ownStats(ctx, 'ash')!.map((s) => s.id)).toEqual(['s-vigor', 's-trust']);
    expect(rowNames()).toEqual(['Vigor', 'Bond', 'Trust']);
  });

  it('deletes a group and moves its stats to the top level of the entity', () => {
    const { ctx } = renderWorldEditorBench(GROUPED, 'advanced');
    openMirror('Ash');
    fireEvent.click(within(treeRow('Bond')).getByRole('button', { name: 'Delete' }));
    expect(ownGroups(ctx, 'ash')).toBeUndefined();
    expect(ownStats(ctx, 'ash')!.map((s) => s.groupId)).toEqual([null, null]);
    expect(rowNames()).toEqual(['Trust', 'Vigor']);
  });

  it('edits a group\'s name through its panel and writes it to the entity', async () => {
    const { ctx } = renderWorldEditorBench(GROUPED, 'advanced');
    openMirror('Ash');
    selectRow('Bond');
    await setGroupName('Trust Ties');
    expect(ownGroups(ctx, 'ash')![0]).toMatchObject({ id: 'g-bond', name: 'Trust Ties', aiDescription: 'How Ash feels about you.' });
    expect(ctx().statGroups![0].name).toBe('World Group');
  });

  it('undoes a group delete and a drop on the entity', async () => {
    const step = (action: () => void) => act(async () => { action(); });
    const { ctx } = renderWorldEditorBench(GROUPED, 'advanced');
    openMirror('Ash');
    await step(() => fireEvent.click(within(treeRow('Bond')).getByRole('button', { name: 'Delete' })));
    expect(ownGroups(ctx, 'ash')).toBeUndefined();
    await step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ownGroups(ctx, 'ash')?.map((g) => g.id)).toEqual(['g-bond']);
    expect(ownStats(ctx, 'ash')!.find((s) => s.id === 's-trust')?.groupId).toBe('g-bond');

    await step(() => drop('s-vigor', 'g-bond'));
    expect(ownStats(ctx, 'ash')!.map((s) => s.id)).toEqual(['s-vigor', 's-trust']);
    await step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ownStats(ctx, 'ash')!.map((s) => s.id)).toEqual(['s-trust', 's-vigor']);
  });

  it('undoes a group add away and back', async () => {
    const step = (action: () => void) => act(async () => { action(); });
    const { ctx } = renderWorldEditorBench(GROUPED, 'advanced');
    openMirror('Ash');
    openAddMenu('Ash');
    fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
    expect(ownGroups(ctx, 'ash')).toHaveLength(2);
    await step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ownGroups(ctx, 'ash')).toHaveLength(1);
    await step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });
    expect(ownGroups(ctx, 'ash')).toHaveLength(2);
  });
});

describe('undo and redo of an entity stat edit', () => {
  const step = (action: () => void) => act(async () => { action(); });
  const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
  const redo = () => step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });

  it('restores the stat and returns to the entity\'s Stats tab from another tab', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    selectRow('Trust');
    fireEvent.change(numberField('Regen'), { target: { value: '5' } });
    expect(ownStats(ctx, 'ash')![0].regen).toBe(5);
    // Away from the entity, to the World Editor's own Stats tab.
    fireEvent.mouseDown(entityFieldsTab('Profile'));
    openEditorTab(/^Stats/);

    await undo();
    expect(ownStats(ctx, 'ash')![0].regen).toBe(0);
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');

    fireEvent.mouseDown(entityFieldsTab('Profile'));
    openEditorTab(/^Stats/);
    await redo();
    expect(ownStats(ctx, 'ash')![0].regen).toBe(5);
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
  });

  it('undoes an added stat away and back', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Odd Wick');
    openAddMenu('Odd Wick');
    fireEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
    expect(ownStats(ctx, 'wick')).toHaveLength(1);
    await undo();
    expect(ownStats(ctx, 'wick')).toBeUndefined();
    await redo();
    expect(ownStats(ctx, 'wick')).toHaveLength(1);
  });
});
