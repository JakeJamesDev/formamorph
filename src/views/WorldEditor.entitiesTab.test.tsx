import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, asMobile, pickEditorMode, shownEditorTab, entityFieldsTab, openTraitFieldsTab } from '@/test/worldEditorBench';
import type { World, Entity, Stat } from '@/types';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import {  } from 'lexical';
import type { SortableTreeAdapter } from '@/managers/SortableTree';
import type { FlatTraitNode } from '@/lib/traitTree';

/** How the view holds the Entities tab: the open entity across tabs, a folder's panel, a card's Add, the panel under a mode switch, chord undo of a stat, and the mirrors that open another tab or push over the list on mobile. */

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

{
const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e-wick', name: 'Odd Wick', locations: ['harbor'], groupId: null, order: 0 },
    { id: 'e-wren', name: 'Wren', locations: ['harbor'], groupId: null, order: 1 },
    {
      id: 'e-you', name: 'Wanderer', customPersona: true, groupId: null, order: 2,
      traits: [{ id: 't-grit', name: 'Grit', statChanges: [], groupId: null, order: 0 }],
    },
  ],
  entityGroups: [{ id: 'g-crew', name: 'Crew', parentId: null, order: 3 }],
} as Partial<World>);

const shownName = () => {
  const field = screen.queryByLabelText('Name');
  if (!field) return null;
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

beforeEach(() => { localStorage.clear(); });


describe('the Entities tab selection', () => {
  it('reopens the entity after a trip to another tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(screen.getByText('Wren'));

    openEditorTab(/Stats/);
    openEditorTab(/Entities/);
    expect(shownName()).toBe('Wren');
  });

  it('opens a folder\'s panel from the tree', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);

    fireEvent.click(screen.getByText('Crew'));
    expect(screen.getByText('Group Name')).toBeInTheDocument();
  });
});
}

{
const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'] },
    { id: 'e2', name: 'Marsh Tom', aiDescription: 'A ferryman.', locations: ['harbor'] },
  ],
});

// On mobile the editor's tabs sit behind the Sections bar, which the shared helper opens.
const openTab = openEditorTab;

const FIELD_LABELS =
  /^(Name|Aliases|Type|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Locations|Placement|Starts At|Image|Image Tags|3D Model)$/;

/** Every field label the panel shows, in document order. The editor's own Locations tab shares a label with
 *  the picker, so the match is taken from the panel body rather than the whole editor. */
const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The entity panel's own strip. The editor's top-level one carries a Placeholders tab of its own, so every
 *  read and click here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Entity Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Entity Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectEntity = (name: string) => {
  openTab(/Entities/);
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor entity panel tabs', () => {
  it('falls back to Profile when Simple mode takes the chosen tab away', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Placeholders');
    pickEditorMode('Simple');
    expect(panelTabNames()).toEqual(['Profile', 'Descriptions', 'Items', 'Routine']);
    expect(panelTab('Profile')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Image', 'Name']);
  });

});

}

{
const grouped: Entity = { id: 'grouped', name: 'Grouped', playerDescription: '', aiDescription: '', groupId: 'g1', order: 0 };
const WORLD: World = benchEditorWorld({
  entities: [...benchEditorWorld({}).entities, grouped],
  entityGroups: [{ id: 'g1', name: 'Folk', parentId: null, order: 1 }],
} as Partial<World>);

const DRAFT = { name: 'Maren Holt', aiDescription: 'A gate guard who knows every face in town.' };

async function addFromCard(props: { inGame?: boolean } = {}) {
  const bench = renderWorldEditorBench(WORLD, 'simple', props);
  await waitFor(() => expect(helpWorld.get()?.lean).toBe('editor'));
  act(() => helpWorld.get()!.addEntity!(DRAFT));
  const added = bench.ctx().entities.find((entity) => entity.name === DRAFT.name)!;
  return { bench, added };
}

describe("an entity card's Add in the World Editor", () => {
  it('adds a blank entity at the root with the draft name and AI description', async () => {
    const { bench, added } = await addFromCard();
    const blank: Partial<Entity> = { playerDescription: '', aiSummary: '', type: '', groupId: null };
    expect(added).toMatchObject({ ...blank, ...DRAFT });
    // After the root's ungrouped entities and its one group.
    const rootEntities = WORLD.entities.filter((entity) => !entity.groupId).length;
    expect(added.order).toBe(rootEntities + 1);
    expect(bench.ctx().entities).toHaveLength(WORLD.entities.length + 1);
  });

  it('opens the Entities tab and selects the new entity', async () => {
    await addFromCard();
    expect(shownEditorTab()).toMatch(/Entities/);
    const selected = [...document.querySelectorAll<HTMLElement>('[data-editor-row-selected]')];
    expect(selected.map((row) => row.textContent)).toEqual([expect.stringContaining(DRAFT.name)]);
  });

  it('is undone by undo', async () => {
    const { bench } = await addFromCard();
    act(() => bench.history().undo());
    expect(bench.ctx().entities.map((entity) => entity.name)).not.toContain(DRAFT.name);
    expect(bench.ctx().entities).toHaveLength(WORLD.entities.length);
  });

  it('works in the in-game World Editor', async () => {
    const { bench } = await addFromCard({ inGame: true });
    expect(bench.ctx().entities.map((entity) => entity.name)).toContain(DRAFT.name);
  });
});
}

{
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
/** The stat tree's rows: the grips inside the stat list, so the Entities tree beside it never counts. */
const statList = () => {
  let el = searchBox().parentElement;
  while (el && !el.querySelector('[aria-label="Drag to reorder or nest"]')) el = el.parentElement;
  return el ?? document.body;
};
const treeRows = () => within(statList()).queryAllByLabelText('Drag to reorder or nest').map((grip) => grip.parentElement as HTMLElement);
const treeRow = (name: string) => treeRows().find((r) => within(r).queryByText(name, { exact: true }))!;
const selectRow = (name: string) => fireEvent.click(within(treeRow(name)).getByText(name, { exact: true }));
const ownStats = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!.stats;
const panelOpen = () => !!screen.queryByRole('tablist', { name: 'Stat Fields' });
/** The Details tab's number fields hold no label link, so they are read in the order the panel draws them. */
const numberField = (name: 'Base Value' | 'Min' | 'Max' | 'Regen') =>
  screen.getAllByRole('spinbutton')[['Base Value', 'Min', 'Max', 'Regen'].indexOf(name)];

beforeEach(() => { localStorage.clear(); drops.length = 0; });

describe('the entity Stats tab', () => {
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
}

{

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
          requires: [{ all: [{ kind: 'trait', id: 't-paladin' }] }, { all: [{ kind: 'trait', id: 't-tamed' }] }, { all: [{ kind: 'trait', id: 't-tamer' }] }],
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
const searchBox = () => screen.getByPlaceholderText('Filter Traits');
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
  // The strip's measuring box is what shares the arrow's row.
  const arrow = within(list.closest('[data-collapsing-root]')!.parentElement!).queryByRole('button', { name });
  return !!arrow && !list.contains(arrow) && !!(arrow.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING);
};
const entity = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!;

beforeEach(() => { localStorage.clear(); adapters.length = 0; });

describe('the entity Traits tab as a mirror', () => {
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

  it('edits a link as its own overrides, with Reset to Blueprint and no way to the Traits tab', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openMirror('Ash');
    fireEvent.click(screen.getByRole('button', { name: 'Open Beast Tamer' }));
    const line = screen.getByText(/^Linked from/);
    expect(line).toHaveTextContent('Linked from Blueprints › Beast Tamer');
    expect(within(line).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Blueprint' })).toBeNull();
    openTraitFieldsTab('Availability');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Starts' })).getByRole('radio', { name: 'On' }));
    expect(entity(ctx, 'ash').traitLinks![0].overrides).toEqual({ 't-tamer': { isDefault: { value: true, blueprint: false } } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
    expect(entity(ctx, 'ash').traitLinks![0]).not.toHaveProperty('overrides');
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
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
      // No push draws a row of its own for the control: the editor header's Back is the only one named Back.
      expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: /^(Traits|Entities)$/ })).toBeNull();
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
}
